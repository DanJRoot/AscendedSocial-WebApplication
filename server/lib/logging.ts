/**
 * Structured logging module for the content platform.
 *
 * Provides consistent JSON-formatted log output with severity levels,
 * context tags, and error tracking. Designed for easy aggregation
 * by log collectors (Datadog, CloudWatch, Loki, etc.).
 *
 * Usage:
 *   import { logger } from "./logging";
 *   logger.info("Video uploaded", { videoId: 123, element: "Water" });
 *   logger.error("AI analysis failed", { error: err, contentId: 456 });
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatError(err: unknown): LogEntry["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { name: "UnknownError", message: String(err) };
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "video-elements-platform",
  };

  // Separate error objects from context
  if (context) {
    const { error, ...rest } = context;
    if (error) entry.error = formatError(error);
    if (Object.keys(rest).length > 0) entry.context = rest;
  }

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
    case "fatal":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }

  // Track error metrics
  if (level === "error" || level === "fatal") {
    errorMetrics.totalErrors++;
    errorMetrics.lastErrorAt = Date.now();
    if (context?.category) {
      const cat = String(context.category);
      errorMetrics.byCategory[cat] = (errorMetrics.byCategory[cat] || 0) + 1;
    }
  }
}

// ── Public logger API ────────────────────────────────────────

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
  fatal: (msg: string, ctx?: Record<string, unknown>) => emit("fatal", msg, ctx),

  /** Create a child logger with pre-set context fields. */
  child(defaults: Record<string, unknown>) {
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) =>
        emit("debug", msg, { ...defaults, ...ctx }),
      info: (msg: string, ctx?: Record<string, unknown>) =>
        emit("info", msg, { ...defaults, ...ctx }),
      warn: (msg: string, ctx?: Record<string, unknown>) =>
        emit("warn", msg, { ...defaults, ...ctx }),
      error: (msg: string, ctx?: Record<string, unknown>) =>
        emit("error", msg, { ...defaults, ...ctx }),
      fatal: (msg: string, ctx?: Record<string, unknown>) =>
        emit("fatal", msg, { ...defaults, ...ctx }),
    };
  },
};

// ── Error metrics for monitoring endpoint ────────────────────

interface ErrorMetrics {
  totalErrors: number;
  lastErrorAt: number | null;
  byCategory: Record<string, number>;
}

const errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  lastErrorAt: null,
  byCategory: {},
};

export function getErrorMetrics(): Readonly<ErrorMetrics> {
  return { ...errorMetrics };
}

export function resetErrorMetrics(): void {
  errorMetrics.totalErrors = 0;
  errorMetrics.lastErrorAt = null;
  errorMetrics.byCategory = {};
}

// ── Specialized loggers for common subsystems ────────────────

export const aiLogger = logger.child({ category: "ai-analysis" });
export const moderationLogger = logger.child({ category: "moderation" });
export const uploadLogger = logger.child({ category: "upload" });
export const feedLogger = logger.child({ category: "feed" });
export const wsLogger = logger.child({ category: "websocket" });

export default logger;
