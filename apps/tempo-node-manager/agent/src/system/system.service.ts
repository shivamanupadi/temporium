import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';

export interface SystemInfo {
  cpu: {
    cores: number;
    model: string;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  storage: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    host: string;
  };
}

@Injectable()
export class SystemService {
  async getSystemInfo(host: string): Promise<SystemInfo> {
    const [cpu, cpuLoad, mem, disk] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    // Get the root filesystem (mount point "/") or the largest disk
    const rootDisk =
      disk.find(d => d.mount === '/') ||
      disk.reduce((prev, curr) => (curr.size > prev.size ? curr : prev));

    // Calculate used from total - available (more reliable)
    const storageUsed = rootDisk.size - rootDisk.available;
    const storageUsagePercent =
      rootDisk.size > 0 ? Math.round((storageUsed / rootDisk.size) * 100) : 0;

    return {
      cpu: {
        cores: cpu.cores,
        model: cpu.brand || cpu.manufacturer,
        usage: Math.round(cpuLoad.currentLoad),
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usagePercent: Math.round((mem.used / mem.total) * 100),
      },
      storage: {
        total: rootDisk.size,
        used: storageUsed,
        free: rootDisk.available,
        usagePercent: storageUsagePercent,
      },
      network: {
        host,
      },
    };
  }
}
