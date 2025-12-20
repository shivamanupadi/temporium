import { Injectable, Logger } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { NodeInfo, NodeActionResponse, SyncStatus, SyncStage } from '#types/index';
import * as fs from 'fs';
import * as path from 'path';

export interface SnapshotInfo {
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string | null;
}

interface InternalSnapshotStatus {
  isDownloading: boolean;
  progress: number;
  lastLog: string | null;
}

export interface SnapshotDownloadStatus extends InternalSnapshotStatus {
  snapshot: SnapshotInfo;
}

@Injectable()
export class NodeService {
  private readonly logger = new Logger(NodeService.name);
  private snapshotStatus: InternalSnapshotStatus = {
    isDownloading: false,
    progress: 0,
    lastLog: null,
  };

  constructor(private dockerService: DockerService) {}

  async getNodeInfo(): Promise<NodeInfo> {
    const status = await this.dockerService.getStatus();
    const containerId = await this.dockerService.getContainerId();
    const startedAt = await this.dockerService.getContainerStartTime();
    const config = this.dockerService.getConfig();

    let syncStatus: SyncStatus | undefined;
    let uptime: number | undefined;
    let version = config.version;

    if (status === 'running' || status === 'stopped') {
      // Get actual image version from Docker
      const imageVersion = await this.dockerService.getImageVersion();
      if (imageVersion) {
        version = imageVersion;
      }
    }

    if (status === 'running') {
      syncStatus = await this.getSyncStatus();

      if (startedAt) {
        const startTime = new Date(startedAt).getTime();
        uptime = Math.floor((Date.now() - startTime) / 1000);
      }
    }

    return {
      status,
      containerId,
      containerName: 'tempo-node',
      version,
      syncStatus,
      config,
      startedAt,
      uptime,
    };
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const config = this.dockerService.getConfig();
      const rpcUrl = `http://localhost:${config.httpPort}`;

      // Get current block number
      const blockResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      const blockData = await blockResponse.json();
      const currentBlock = parseInt(blockData.result, 16);

      // Get peer count
      const peerResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'net_peerCount',
          params: [],
          id: 2,
        }),
      });
      const peerData = await peerResponse.json();
      const peerCount = parseInt(peerData.result, 16);

      // Get syncing status
      const syncResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_syncing',
          params: [],
          id: 3,
        }),
      });
      const syncData = await syncResponse.json();

      let highestBlock = currentBlock;
      let actualCurrentBlock = currentBlock;
      let isSynced = true;
      let syncProgress = 100;
      let stages: SyncStage[] | undefined;

      if (syncData.result && typeof syncData.result === 'object') {
        // Parse stages if available
        if (Array.isArray(syncData.result.stages)) {
          stages = syncData.result.stages.map((s: { name: string; block: string }) => ({
            name: s.name,
            block: parseInt(s.block, 16),
          }));

          // Use Headers stage block as the target (highest known block)
          const headersStage = stages?.find(s => s.name === 'Headers');
          const executionStage = stages?.find(s => s.name === 'Execution');

          if (headersStage && headersStage.block > 0) {
            highestBlock = headersStage.block;
          }

          // Use Execution stage as current progress - this is the actual sync progress
          // eth_blockNumber returns snapshot block until sync is complete
          if (executionStage && executionStage.block > 0) {
            actualCurrentBlock = executionStage.block;
          }
        } else if (syncData.result.highestBlock) {
          highestBlock = parseInt(syncData.result.highestBlock, 16);
        }

        isSynced = false;
        syncProgress = highestBlock > 0 ? Math.floor((actualCurrentBlock / highestBlock) * 100) : 0;
      }

      return {
        currentBlock: actualCurrentBlock,
        highestBlock,
        peerCount,
        isSynced,
        syncProgress,
        stages,
      };
    } catch (error) {
      this.logger.warn('Failed to get sync status:', error);
      return {
        currentBlock: 0,
        highestBlock: 0,
        peerCount: 0,
        isSynced: false,
        syncProgress: 0,
      };
    }
  }

  async startNode(): Promise<NodeActionResponse> {
    try {
      await this.dockerService.startContainer();
      return {
        success: true,
        message: 'Node started successfully',
        containerId: await this.dockerService.getContainerId(),
      };
    } catch (error) {
      this.logger.error('Failed to start node:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start node',
      };
    }
  }

  async stopNode(): Promise<NodeActionResponse> {
    try {
      await this.dockerService.stopContainer();
      return {
        success: true,
        message: 'Node stopped successfully',
      };
    } catch (error) {
      this.logger.error('Failed to stop node:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop node',
      };
    }
  }

  async restartNode(): Promise<NodeActionResponse> {
    try {
      await this.dockerService.restartContainer();
      return {
        success: true,
        message: 'Node restarted successfully',
        containerId: await this.dockerService.getContainerId(),
      };
    } catch (error) {
      this.logger.error('Failed to restart node:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restart node',
      };
    }
  }

  async pullImage(): Promise<NodeActionResponse> {
    try {
      await this.dockerService.pullImage();
      return {
        success: true,
        message: 'Image pulled successfully',
      };
    } catch (error) {
      this.logger.error('Failed to pull image:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to pull image',
      };
    }
  }

  async deleteContainer(): Promise<NodeActionResponse> {
    try {
      const status = await this.dockerService.getStatus();
      if (status === 'running') {
        return {
          success: false,
          message: 'Cannot delete a running container. Please stop the node first.',
        };
      }
      await this.dockerService.removeContainer();
      return {
        success: true,
        message: 'Container deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete container:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete container',
      };
    }
  }

  getSnapshotStatus(): SnapshotDownloadStatus {
    const snapshot = this.getSnapshotInfo();
    return { ...this.snapshotStatus, snapshot };
  }

  private getSnapshotInfo(): SnapshotInfo {
    const config = this.dockerService.getConfig();
    const dataDir = config.dataDir;
    const dbPath = path.join(dataDir, 'db');

    try {
      if (!fs.existsSync(dbPath)) {
        return {
          exists: false,
          sizeBytes: 0,
          sizeFormatted: '0 B',
          lastModified: null,
        };
      }

      // Calculate total size of db directory
      const sizeBytes = this.getDirectorySize(dbPath);
      const sizeFormatted = this.formatBytes(sizeBytes);

      // Get last modified time
      const stats = fs.statSync(dbPath);
      const lastModified = stats.mtime.toISOString();

      return {
        exists: sizeBytes > 1024 * 1024, // Consider exists if > 1MB
        sizeBytes,
        sizeFormatted,
        lastModified,
      };
    } catch (error) {
      this.logger.warn('Failed to get snapshot info:', error);
      return {
        exists: false,
        sizeBytes: 0,
        sizeFormatted: '0 B',
        lastModified: null,
      };
    }
  }

  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch {
      // Ignore errors for individual files/directories
    }

    return totalSize;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async downloadSnapshot(): Promise<NodeActionResponse> {
    if (this.snapshotStatus.isDownloading) {
      return {
        success: false,
        message: 'Snapshot download already in progress',
      };
    }

    // Check if node is running
    const status = await this.dockerService.getStatus();
    if (status === 'running') {
      return {
        success: false,
        message: 'Please stop the node before downloading snapshot',
      };
    }

    // Start download in background
    this.snapshotStatus = {
      isDownloading: true,
      progress: 0,
      lastLog: 'Starting download...',
    };

    // Run download asynchronously
    this.runSnapshotDownload();

    return {
      success: true,
      message: 'Snapshot download started',
    };
  }

  private parseDownloadProgress(logLine: string): number | null {
    // Pattern 1: Byte-based progress like "1.5 GB / 3.0 GB" or "1.5GiB/3.0GiB" or "1500MB/3000MB"
    const bytePattern =
      /([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)\s*[/]\s*([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i;
    const byteMatch = logLine.match(bytePattern);
    if (byteMatch) {
      const downloaded = this.parseBytes(parseFloat(byteMatch[1]), byteMatch[2]);
      const total = this.parseBytes(parseFloat(byteMatch[3]), byteMatch[4]);
      if (total > 0) {
        return Math.min(99, Math.floor((downloaded / total) * 100));
      }
    }

    // Pattern 2: Parenthesized percentage like "(50%)" - common in download tools
    const parenPercentMatch = logLine.match(/\((\d{1,3})%\)/);
    if (parenPercentMatch) {
      const percent = parseInt(parenPercentMatch[1], 10);
      if (percent >= 0 && percent <= 100) {
        return percent;
      }
    }

    // Pattern 3: Progress indicator with context like "Progress: 50%" or "Downloaded: 50%"
    const contextPercentMatch = logLine.match(/(?:progress|download|complete)[:\s]+(\d{1,3})%/i);
    if (contextPercentMatch) {
      const percent = parseInt(contextPercentMatch[1], 10);
      if (percent >= 0 && percent <= 100) {
        return percent;
      }
    }

    // Pattern 4: Standalone percentage at end of line or with spaces around it
    const standalonePercentMatch = logLine.match(/\s(\d{1,3})%(?:\s|$)/);
    if (standalonePercentMatch) {
      const percent = parseInt(standalonePercentMatch[1], 10);
      if (percent >= 0 && percent <= 100) {
        return percent;
      }
    }

    return null;
  }

  private parseBytes(value: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      kib: 1024,
      mb: 1024 * 1024,
      mib: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      gib: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
      tib: 1024 * 1024 * 1024 * 1024,
    };
    return value * (multipliers[unitLower] || 1);
  }

  private async runSnapshotDownload(): Promise<void> {
    try {
      await this.dockerService.runDownloadCommand((logLine: string) => {
        this.snapshotStatus.lastLog = logLine;

        // Parse progress using improved patterns
        const progress = this.parseDownloadProgress(logLine);
        if (progress !== null) {
          this.snapshotStatus.progress = progress;
        }
      });

      this.snapshotStatus = {
        isDownloading: false,
        progress: 100,
        lastLog: 'Download completed successfully',
      };
    } catch (error) {
      this.logger.error('Snapshot download failed:', error);
      this.snapshotStatus = {
        isDownloading: false,
        progress: 0,
        lastLog: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }
}
