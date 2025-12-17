import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as si from 'systeminformation';
import * as promClient from 'prom-client';
import {
  SystemMetrics,
  MetricsDataPoint,
  CpuMetrics,
  MemoryMetrics,
  DiskMetrics,
  NetworkMetrics,
} from '@temporium/tempo-node-types';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private metricsHistory: MetricsDataPoint[] = [];
  private maxHistorySize = 1000;
  private dataDir: string;

  // Prometheus metrics
  private readonly registry: promClient.Registry;
  private readonly cpuUsageGauge: promClient.Gauge;
  private readonly memoryUsageGauge: promClient.Gauge;
  private readonly memoryTotalGauge: promClient.Gauge;
  private readonly memoryUsedGauge: promClient.Gauge;
  private readonly diskUsageGauge: promClient.Gauge;
  private readonly diskTotalGauge: promClient.Gauge;
  private readonly diskUsedGauge: promClient.Gauge;
  private readonly networkRxGauge: promClient.Gauge;
  private readonly networkTxGauge: promClient.Gauge;
  private readonly uptimeGauge: promClient.Gauge;

  constructor(private configService: ConfigService) {
    this.dataDir = this.configService.get(
      'TEMPO_DATA_DIR',
      '/var/lib/tempo',
    );

    // Initialize Prometheus registry
    this.registry = new promClient.Registry();

    // Add default metrics (nodejs process metrics)
    promClient.collectDefaultMetrics({ register: this.registry });

    // Custom metrics for Tempo node manager
    this.cpuUsageGauge = new promClient.Gauge({
      name: 'tempo_manager_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    this.memoryUsageGauge = new promClient.Gauge({
      name: 'tempo_manager_memory_usage_percent',
      help: 'Memory usage percentage',
      registers: [this.registry],
    });

    this.memoryTotalGauge = new promClient.Gauge({
      name: 'tempo_manager_memory_total_bytes',
      help: 'Total memory in bytes',
      registers: [this.registry],
    });

    this.memoryUsedGauge = new promClient.Gauge({
      name: 'tempo_manager_memory_used_bytes',
      help: 'Used memory in bytes',
      registers: [this.registry],
    });

    this.diskUsageGauge = new promClient.Gauge({
      name: 'tempo_manager_disk_usage_percent',
      help: 'Disk usage percentage',
      registers: [this.registry],
    });

    this.diskTotalGauge = new promClient.Gauge({
      name: 'tempo_manager_disk_total_bytes',
      help: 'Total disk space in bytes',
      registers: [this.registry],
    });

    this.diskUsedGauge = new promClient.Gauge({
      name: 'tempo_manager_disk_used_bytes',
      help: 'Used disk space in bytes',
      registers: [this.registry],
    });

    this.networkRxGauge = new promClient.Gauge({
      name: 'tempo_manager_network_rx_bytes_per_sec',
      help: 'Network receive bytes per second',
      registers: [this.registry],
    });

    this.networkTxGauge = new promClient.Gauge({
      name: 'tempo_manager_network_tx_bytes_per_sec',
      help: 'Network transmit bytes per second',
      registers: [this.registry],
    });

    this.uptimeGauge = new promClient.Gauge({
      name: 'tempo_manager_system_uptime_seconds',
      help: 'System uptime in seconds',
      registers: [this.registry],
    });
  }

  async onModuleInit() {
    // Start collecting metrics every 30 seconds
    setInterval(() => this.collectAndStore(), 30000);
    // Collect initial metrics
    await this.collectAndStore();
  }

  /**
   * Get Prometheus metrics in text format
   */
  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus metrics
   */
  getPrometheusContentType(): string {
    return this.registry.contentType;
  }

  async getCurrentMetrics(): Promise<SystemMetrics> {
    const [cpu, mem, disk, network, time] = await Promise.all([
      this.getCpuMetrics(),
      this.getMemoryMetrics(),
      this.getDiskMetrics(),
      this.getNetworkMetrics(),
      si.time(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      cpu,
      memory: mem,
      disk,
      network,
      uptime: time.uptime,
    };
  }

  async getCpuMetrics(): Promise<CpuMetrics> {
    const [load, cpuInfo] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
    ]);

    return {
      usagePercent: Math.round(load.currentLoad * 100) / 100,
      cores: cpuInfo.cores,
      model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
    };
  }

  async getMemoryMetrics(): Promise<MemoryMetrics> {
    const mem = await si.mem();

    return {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      usagePercent: Math.round((mem.used / mem.total) * 10000) / 100,
    };
  }

  async getDiskMetrics(): Promise<DiskMetrics> {
    const disks = await si.fsSize();

    // Find the disk that contains the data directory
    let targetDisk = disks.find((d) => this.dataDir.startsWith(d.mount));

    // Fallback to root if not found
    if (!targetDisk) {
      targetDisk = disks.find((d) => d.mount === '/') || disks[0];
    }

    if (!targetDisk) {
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
        path: this.dataDir,
      };
    }

    return {
      total: targetDisk.size,
      used: targetDisk.used,
      free: targetDisk.available,
      usagePercent: Math.round(targetDisk.use * 100) / 100,
      path: targetDisk.mount,
    };
  }

  async getNetworkMetrics(): Promise<NetworkMetrics> {
    const stats = await si.networkStats();
    const primaryInterface = stats[0];

    if (!primaryInterface) {
      return {
        rxBytesPerSec: 0,
        txBytesPerSec: 0,
        totalRx: 0,
        totalTx: 0,
      };
    }

    return {
      rxBytesPerSec: Math.round(primaryInterface.rx_sec || 0),
      txBytesPerSec: Math.round(primaryInterface.tx_sec || 0),
      totalRx: primaryInterface.rx_bytes,
      totalTx: primaryInterface.tx_bytes,
    };
  }

  async getHistory(limit: number = 100): Promise<MetricsDataPoint[]> {
    return this.metricsHistory.slice(-limit);
  }

  private async collectAndStore(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();

      // Update Prometheus gauges
      this.cpuUsageGauge.set(metrics.cpu.usagePercent);
      this.memoryUsageGauge.set(metrics.memory.usagePercent);
      this.memoryTotalGauge.set(metrics.memory.total);
      this.memoryUsedGauge.set(metrics.memory.used);
      this.diskUsageGauge.set(metrics.disk.usagePercent);
      this.diskTotalGauge.set(metrics.disk.total);
      this.diskUsedGauge.set(metrics.disk.used);
      this.networkRxGauge.set(metrics.network.rxBytesPerSec);
      this.networkTxGauge.set(metrics.network.txBytesPerSec);
      this.uptimeGauge.set(metrics.uptime);

      const dataPoint: MetricsDataPoint = {
        timestamp: metrics.timestamp,
        cpuUsage: metrics.cpu.usagePercent,
        memoryUsage: metrics.memory.usagePercent,
        diskUsage: metrics.disk.usagePercent,
        networkRx: metrics.network.rxBytesPerSec,
        networkTx: metrics.network.txBytesPerSec,
      };

      this.metricsHistory.push(dataPoint);

      // Trim history if needed
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }
}
