/**
 * Rate limiting middleware for Express.
 *
 * Implements a sliding-window counter per IP address using an in-memory store.
 * Designed to prevent abuse on upload and mutation endpoints.
 *
 * For production multi-process deployments, swap the store with Redis (ioredis).
 */

import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

class RateLimitStore {
  private windows = new Map<string, WindowEntry>();
  private cleanup: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanup = setInterval(() => this.purge(), cleanupIntervalMs);
    if (this.cleanup.unref) this.cleanup.unref();
  }

  /**
   * Increment the counter for a key.
   * Returns the current count and the time remaining until reset (ms).
   */
  hit(key: string, windowMs: number): { count: number; resetMs: number } {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { count: 1, resetMs: windowMs };
    }

    entry.count++;
    return { count: entry.count, resetMs: entry.resetAt - now };
  }

  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.windows.entries())) {
      if (now > entry.resetAt) this.windows.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.cleanup);
    this.windows.clear();
  }
}

const store = new RateLimitStore();

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 30) */
  max?: number;
  /** Custom message on limit exceeded */
  message?: string;
  /** Key generator — defaults to IP address */
  keyGenerator?: (req: Request) => string;
}

/**
 * Create a rate-limiting middleware.
 *
 * ```ts
 * app.post("/api/content/video/upload", rateLimit({ windowMs: 60_000, max: 5 }), handler);
 * ```
 */
export function rateLimit(opts: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 30,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || "unknown",
  } = opts;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const { count, resetMs } = store.hit(key, windowMs);

    // Set rate-limit headers (draft standard)
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(resetMs / 1000)));

    if (count > max) {
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

// ── Pre-configured limiters for common use cases ─────────────

/** Upload: 5 uploads per minute per IP */
export const uploadRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: "Upload rate limit exceeded. Maximum 5 uploads per minute.",
});

/** API general: 60 requests per minute per IP */
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: "API rate limit exceeded. Please slow down.",
});

/** Auth: 10 attempts per minute per IP */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: "Too many authentication attempts.",
});

export default rateLimit;
