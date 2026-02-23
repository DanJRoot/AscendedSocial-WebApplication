/**
 * OpenAI API cost monitoring and analysis job batching.
 *
 * Tracks estimated costs per request, enforces budget limits,
 * and batches analysis jobs to reduce API overhead.
 */

import { logger } from "./logging";

// ── Cost estimation (approximate per-model pricing) ─────────

interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 },
  "gpt-4o-mini": { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
  "gpt-4-turbo": { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
};

// ── Cost tracker ────────────────────────────────────────────

interface CostRecord {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  operation: string;
}

class CostMonitor {
  private records: CostRecord[] = [];
  private budgetLimitUSD: number;
  private budgetWindowMs: number;

  constructor(
    budgetLimitUSD = parseFloat(process.env.OPENAI_BUDGET_LIMIT_USD || "50"),
    budgetWindowHours = parseInt(process.env.OPENAI_BUDGET_WINDOW_HOURS || "24", 10)
  ) {
    this.budgetLimitUSD = budgetLimitUSD;
    this.budgetWindowMs = budgetWindowHours * 60 * 60 * 1000;
  }

  /**
   * Record an API call and estimate its cost.
   */
  record(
    model: string,
    inputTokens: number,
    outputTokens: number,
    operation: string
  ): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
    const estimatedCost =
      (inputTokens / 1000) * pricing.inputPer1kTokens +
      (outputTokens / 1000) * pricing.outputPer1kTokens;

    const record: CostRecord = {
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
      operation,
    };

    this.records.push(record);
    this.pruneOldRecords();

    if (this.isOverBudget()) {
      logger.warn("OpenAI budget limit approaching", {
        currentSpend: this.getCurrentSpend().toFixed(4),
        limit: this.budgetLimitUSD,
        category: "ai-cost",
      });
    }

    return estimatedCost;
  }

  /**
   * Check whether we're over the budget period limit.
   */
  isOverBudget(): boolean {
    return this.getCurrentSpend() >= this.budgetLimitUSD * 0.9; // warn at 90%
  }

  /**
   * Check whether API calls should be blocked due to budget.
   */
  shouldBlock(): boolean {
    return this.getCurrentSpend() >= this.budgetLimitUSD;
  }

  /**
   * Get total estimated spend in the current budget window.
   */
  getCurrentSpend(): number {
    const cutoff = Date.now() - this.budgetWindowMs;
    return this.records
      .filter((r) => r.timestamp >= cutoff)
      .reduce((sum, r) => sum + r.estimatedCost, 0);
  }

  /**
   * Get cost breakdown for monitoring dashboard.
   */
  getStats(): {
    totalSpent: number;
    requestCount: number;
    avgCostPerRequest: number;
    byOperation: Record<string, { count: number; cost: number }>;
    budgetRemaining: number;
    budgetLimitUSD: number;
  } {
    const cutoff = Date.now() - this.budgetWindowMs;
    const recent = this.records.filter((r) => r.timestamp >= cutoff);
    const totalSpent = recent.reduce((s, r) => s + r.estimatedCost, 0);

    const byOperation: Record<string, { count: number; cost: number }> = {};
    for (const r of recent) {
      if (!byOperation[r.operation]) {
        byOperation[r.operation] = { count: 0, cost: 0 };
      }
      byOperation[r.operation].count++;
      byOperation[r.operation].cost += r.estimatedCost;
    }

    return {
      totalSpent,
      requestCount: recent.length,
      avgCostPerRequest: recent.length > 0 ? totalSpent / recent.length : 0,
      byOperation,
      budgetRemaining: Math.max(0, this.budgetLimitUSD - totalSpent),
      budgetLimitUSD: this.budgetLimitUSD,
    };
  }

  private pruneOldRecords(): void {
    const cutoff = Date.now() - this.budgetWindowMs * 2;
    this.records = this.records.filter((r) => r.timestamp >= cutoff);
  }
}

export const costMonitor = new CostMonitor();

// ── Analysis job batching ───────────────────────────────────

interface BatchJob {
  id: string;
  payload: { title: string; description?: string; videoUrl?: string };
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
}

class AnalysisBatcher {
  private queue: BatchJob[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private batchSize: number;
  private flushIntervalMs: number;
  private processor: (jobs: BatchJob[]) => Promise<void>;

  constructor(
    processor: (jobs: BatchJob[]) => Promise<void>,
    batchSize = 5,
    flushIntervalMs = 10_000 // 10 seconds
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.flushIntervalMs = flushIntervalMs;
  }

  /**
   * Enqueue an analysis job. Returns a promise that resolves when the batch is processed.
   */
  enqueue(payload: BatchJob["payload"]): Promise<any> {
    return new Promise((resolve, reject) => {
      const job: BatchJob = {
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        payload,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      this.queue.push(job);

      // Flush if batch size reached
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.flushTimer) {
        // Set timer for partial batch
        this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    logger.info("Processing analysis batch", {
      batchSize: batch.length,
      category: "ai-cost",
    });

    try {
      await this.processor(batch);
    } catch (error) {
      // Reject all jobs in the failed batch
      for (const job of batch) {
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

/**
 * Create an analysis batcher. Pass your analysis function as the processor.
 *
 * Usage:
 *   const batcher = createAnalysisBatcher(async (jobs) => {
 *     for (const job of jobs) {
 *       const result = await analyzeContent(job.payload);
 *       job.resolve(result);
 *     }
 *   });
 *
 *   const result = await batcher.enqueue({ title: "My Video", videoUrl: "..." });
 */
export function createAnalysisBatcher(
  processor: (jobs: BatchJob[]) => Promise<void>,
  batchSize?: number,
  flushIntervalMs?: number
): AnalysisBatcher {
  return new AnalysisBatcher(processor, batchSize, flushIntervalMs);
}

export default costMonitor;
