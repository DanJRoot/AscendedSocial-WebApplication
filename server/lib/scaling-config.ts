/**
 * Auto-scaling configuration for high-traffic periods.
 *
 * Defines scaling policies, thresholds, and resource limits
 * for the video elements platform when deployed on scalable infrastructure
 * (Replit Autoscale, Docker Swarm, Kubernetes, etc.).
 *
 * This config is consumed by the deployment manifests and monitoring systems.
 */

export interface ScalingPolicy {
  /** Minimum replicas / instances */
  minReplicas: number;
  /** Maximum replicas / instances */
  maxReplicas: number;
  /** Target CPU utilisation (0-100) to trigger scale-up */
  targetCpuPercent: number;
  /** Target memory utilisation (0-100) to trigger scale-up */
  targetMemoryPercent: number;
  /** Seconds to wait before scaling down after load drops */
  cooldownSeconds: number;
  /** Minimum seconds between scale-up events */
  scaleUpStabilizationSeconds: number;
}

export interface ResourceLimits {
  /** Max CPU cores per instance */
  cpuLimit: number;
  /** Max memory in MB per instance */
  memoryLimitMB: number;
  /** Requested (guaranteed) CPU cores */
  cpuRequest: number;
  /** Requested (guaranteed) memory in MB */
  memoryRequestMB: number;
}

export interface ScalingConfig {
  app: ScalingPolicy;
  resources: ResourceLimits;
  database: {
    /** Max connections across all instances */
    maxTotalConnections: number;
    /** Connections per app instance */
    connectionsPerInstance: number;
  };
  rateLimits: {
    /** Requests per minute per IP on upload */
    uploadPerMinute: number;
    /** Requests per minute per IP on general API */
    apiPerMinute: number;
  };
}

// ── Default configuration (Replit / small deployment) ───────

const defaultConfig: ScalingConfig = {
  app: {
    minReplicas: 1,
    maxReplicas: 3,
    targetCpuPercent: 70,
    targetMemoryPercent: 80,
    cooldownSeconds: 300,        // 5 min cooldown before scaling down
    scaleUpStabilizationSeconds: 60,
  },
  resources: {
    cpuLimit: 2,
    memoryLimitMB: 1024,
    cpuRequest: 0.5,
    memoryRequestMB: 256,
  },
  database: {
    maxTotalConnections: 30,     // Replit PostgreSQL typically allows ~25-50
    connectionsPerInstance: 10,   // Matches DB_POOL_SIZE default
  },
  rateLimits: {
    uploadPerMinute: 5,
    apiPerMinute: 60,
  },
};

// ── Production configuration (higher capacity) ─────────────

const productionConfig: ScalingConfig = {
  app: {
    minReplicas: 2,
    maxReplicas: 8,
    targetCpuPercent: 60,
    targetMemoryPercent: 70,
    cooldownSeconds: 600,
    scaleUpStabilizationSeconds: 30,
  },
  resources: {
    cpuLimit: 4,
    memoryLimitMB: 2048,
    cpuRequest: 1,
    memoryRequestMB: 512,
  },
  database: {
    maxTotalConnections: 100,
    connectionsPerInstance: 12,
  },
  rateLimits: {
    uploadPerMinute: 10,
    apiPerMinute: 120,
  },
};

/**
 * Get scaling config based on NODE_ENV.
 */
export function getScalingConfig(): ScalingConfig {
  if (process.env.NODE_ENV === "production") {
    return productionConfig;
  }
  return defaultConfig;
}

/**
 * Validate current resource usage against scaling thresholds.
 * Returns true if scale-up might be needed.
 */
export function shouldScaleUp(
  currentCpuPercent: number,
  currentMemoryPercent: number
): boolean {
  const config = getScalingConfig();
  return (
    currentCpuPercent > config.app.targetCpuPercent ||
    currentMemoryPercent > config.app.targetMemoryPercent
  );
}

export default getScalingConfig;
