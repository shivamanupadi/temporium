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

// Minimum requirements for running a Tempo node
export const NODE_REQUIREMENTS = {
  cpu: { min: 8, recommended: 16 },
  memory: { min: 16 * 1024 * 1024 * 1024, recommended: 32 * 1024 * 1024 * 1024 }, // 16GB / 32GB in bytes
  storage: { min: 250 * 1024 * 1024 * 1024, recommended: 500 * 1024 * 1024 * 1024 }, // 250GB / 500GB in bytes
};

export interface RequirementCheck {
  name: string;
  current: number;
  currentFormatted: string;
  minimum: number;
  minimumFormatted: string;
  recommended: number;
  recommendedFormatted: string;
  meetsMinimum: boolean;
  meetsRecommended: boolean;
}

export interface SystemRequirements {
  meetsMinimum: boolean;
  meetsRecommended: boolean;
  checks: {
    cpu: RequirementCheck;
    memory: RequirementCheck;
    storage: RequirementCheck;
  };
}

@Injectable()
export class SystemService {
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + ' ' + sizes[i];
  }

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

  async checkRequirements(): Promise<SystemRequirements> {
    const [cpu, mem, disk] = await Promise.all([si.cpu(), si.mem(), si.fsSize()]);

    // Get the root filesystem or the largest disk
    const rootDisk =
      disk.find(d => d.mount === '/') ||
      disk.reduce((prev, curr) => (curr.size > prev.size ? curr : prev));

    const cpuCheck: RequirementCheck = {
      name: 'CPU Cores',
      current: cpu.cores,
      currentFormatted: `${cpu.cores} cores`,
      minimum: NODE_REQUIREMENTS.cpu.min,
      minimumFormatted: `${NODE_REQUIREMENTS.cpu.min} cores`,
      recommended: NODE_REQUIREMENTS.cpu.recommended,
      recommendedFormatted: `${NODE_REQUIREMENTS.cpu.recommended}+ cores`,
      meetsMinimum: cpu.cores >= NODE_REQUIREMENTS.cpu.min,
      meetsRecommended: cpu.cores >= NODE_REQUIREMENTS.cpu.recommended,
    };

    const memoryCheck: RequirementCheck = {
      name: 'Memory (RAM)',
      current: mem.total,
      currentFormatted: this.formatBytes(mem.total),
      minimum: NODE_REQUIREMENTS.memory.min,
      minimumFormatted: this.formatBytes(NODE_REQUIREMENTS.memory.min),
      recommended: NODE_REQUIREMENTS.memory.recommended,
      recommendedFormatted: this.formatBytes(NODE_REQUIREMENTS.memory.recommended),
      meetsMinimum: mem.total >= NODE_REQUIREMENTS.memory.min,
      meetsRecommended: mem.total >= NODE_REQUIREMENTS.memory.recommended,
    };

    const storageCheck: RequirementCheck = {
      name: 'Storage',
      current: rootDisk.available,
      currentFormatted: this.formatBytes(rootDisk.available),
      minimum: NODE_REQUIREMENTS.storage.min,
      minimumFormatted: this.formatBytes(NODE_REQUIREMENTS.storage.min),
      recommended: NODE_REQUIREMENTS.storage.recommended,
      recommendedFormatted: this.formatBytes(NODE_REQUIREMENTS.storage.recommended),
      meetsMinimum: rootDisk.available >= NODE_REQUIREMENTS.storage.min,
      meetsRecommended: rootDisk.available >= NODE_REQUIREMENTS.storage.recommended,
    };

    return {
      meetsMinimum: cpuCheck.meetsMinimum && memoryCheck.meetsMinimum && storageCheck.meetsMinimum,
      meetsRecommended:
        cpuCheck.meetsRecommended && memoryCheck.meetsRecommended && storageCheck.meetsRecommended,
      checks: {
        cpu: cpuCheck,
        memory: memoryCheck,
        storage: storageCheck,
      },
    };
  }
}
