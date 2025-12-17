/**
 * CPU metrics
 */
export interface CpuMetrics {
  usagePercent: number;
  cores: number;
  model: string;
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

/**
 * Disk metrics
 */
export interface DiskMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  path: string;
}

/**
 * Network metrics
 */
export interface NetworkMetrics {
  rxBytesPerSec: number;
  txBytesPerSec: number;
  totalRx: number;
  totalTx: number;
}

/**
 * Complete system metrics
 */
export interface SystemMetrics {
  timestamp: string;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  uptime: number; // system uptime in seconds
}

/**
 * Historical metrics point for charts
 */
export interface MetricsDataPoint {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkRx: number;
  networkTx: number;
}
