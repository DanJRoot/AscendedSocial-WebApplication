/**
 * Feed caching layer with TTL support.
 * Uses an in-memory Map with automatic expiry.
 * Drop-in replaceable with Redis (ioredis) when scaling beyond single-process.
 *
 * Usage:
 *   import { feedCache } from "./cache";
 *   const cached = feedCache.get<FeedItem[]>("feed:Water");
 *   if (!cached) { feedCache.set("feed:Water", data, 300); }
 */

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60_000) {
    // Periodically purge expired entries to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.purgeExpired(), cleanupIntervalMs);
    // Allow Node to exit even if the interval is still running
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /** Get a cached value. Returns undefined if missing or expired. */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  /** Set a cached value with TTL in seconds (default: 300 = 5 minutes). */
  set<T = unknown>(key: string, data: T, ttlSeconds = 300): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /** Delete a specific key. */
  del(key: string): boolean {
    return this.store.delete(key);
  }

  /** Delete all keys matching a prefix (e.g. "feed:"). */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Flush all cached data. */
  flush(): void {
    this.store.clear();
  }

  /** Number of active (non-expired) entries. */
  get size(): number {
    this.purgeExpired();
    return this.store.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for graceful shutdown). */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/** Shared feed cache instance – 5-minute default TTL, cleanup every 60s */
export const feedCache = new InMemoryCache(60_000);

/**
 * Cache-aside helper: returns cached value or calls loader, caches result.
 *
 *   const items = await cacheAside("feed:Water:0", () => queryFeed("Water", 0));
 */
export async function cacheAside<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  const cached = feedCache.get<T>(key);
  if (cached !== undefined) return cached;

  const data = await loader();
  feedCache.set(key, data, ttlSeconds);
  return data;
}

export default feedCache;
