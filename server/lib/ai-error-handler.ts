// AI Error Handler
// Retry logic for AI API failures
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelay * Math.pow(2, attempt),
          opts.maxDelay
        );
        console.warn(
          `[AI Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          lastError.message
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(error: any): boolean {
  return error?.status === 429 || error?.message?.includes("rate limit");
}

export function isTransientError(error: any): boolean {
  const status = error?.status || error?.statusCode;
  return status >= 500 || status === 429 || error?.code === "ECONNRESET";
}
