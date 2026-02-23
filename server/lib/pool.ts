/**
 * Connection pooling configuration and health monitoring.
 *
 * Centralizes pool settings for the PostgreSQL database and
 * any external HTTP API connections (OpenAI, Cloudflare).
 *
 * The pool exported from server/db.ts uses these defaults.
 * Import this module to adjust pool sizing, monitor health,
 * or create additional pools for read-replicas.
 */

import pg from "pg";

// ── Pool configuration derived from environment ──────────────
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000; // 30 seconds
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000; // 5 seconds

export interface PoolConfig {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}

export function getPoolConfig(connString?: string): PoolConfig {
  return {
    connectionString: connString || process.env.DATABASE_URL || "",
    max: parseInt(process.env.DB_POOL_SIZE || String(DEFAULT_POOL_SIZE), 10),
    idleTimeoutMillis: parseInt(
      process.env.DB_IDLE_TIMEOUT_MS || String(DEFAULT_IDLE_TIMEOUT_MS),
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONN_TIMEOUT_MS || String(DEFAULT_CONNECTION_TIMEOUT_MS),
      10,
    ),
    allowExitOnIdle: true,
  };
}

/**
 * Create a configured pg.Pool with health monitoring.
 */
export function createPool(connString?: string): pg.Pool {
  const config = getPoolConfig(connString);
  const pool = new pg.Pool(config);

  pool.on("error", (err) => {
    console.error("[pool] Unexpected error on idle client:", err.message);
  });

  pool.on("connect", () => {
    poolStats.totalConnections++;
  });

  pool.on("remove", () => {
    poolStats.totalConnections = Math.max(0, poolStats.totalConnections - 1);
  });

  return pool;
}

// ── Pool statistics for monitoring ───────────────────────────
interface PoolStats {
  totalConnections: number;
  queriesExecuted: number;
  lastQueryAt: number | null;
}

const poolStats: PoolStats = {
  totalConnections: 0,
  queriesExecuted: 0,
  lastQueryAt: null,
};

export function recordQuery(): void {
  poolStats.queriesExecuted++;
  poolStats.lastQueryAt = Date.now();
}

export function getPoolStats(pool: pg.Pool): Record<string, number | null> {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    totalConnections: poolStats.totalConnections,
    queriesExecuted: poolStats.queriesExecuted,
    lastQueryAt: poolStats.lastQueryAt,
  };
}

/**
 * Health check: attempts a simple query.
 * Returns true if the pool is healthy, false otherwise.
 */
export async function checkPoolHealth(pool: pg.Pool): Promise<boolean> {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

/**
 * Graceful shutdown: drain active connections.
 */
export async function drainPool(pool: pg.Pool): Promise<void> {
  try {
    await pool.end();
    console.log("[pool] All connections drained.");
  } catch (err) {
    console.error("[pool] Error draining pool:", err);
  }
}
