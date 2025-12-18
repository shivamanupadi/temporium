import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Snapshot, SnapshotDownloadProgress, DownloadStatus, SnapshotDownloadHistory } from '#types/index';
import { DockerService } from '../docker/docker.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);
  private downloadProgress: SnapshotDownloadProgress | null = null;
  private isDownloading = false;
  private lastLogLine = '';
  private currentDownloadId: number | null = null;

  constructor(
    private configService: ConfigService,
    private dockerService: DockerService,
    private databaseService: DatabaseService
  ) {}

  async listAvailableSnapshots(): Promise<Snapshot[]> {
    return [
      {
        id: 'latest',
        url: 'Built-in Tempo snapshot',
        blockNumber: 0,
        size: 0,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async getDownloadProgress(): Promise<SnapshotDownloadProgress | null> {
    return this.downloadProgress;
  }

  getLastLogLine(): string {
    return this.lastLogLine;
  }

  isDownloadInProgress(): boolean {
    return this.isDownloading;
  }

  updateProgress(logLine: string): void {
    this.lastLogLine = logLine;

    // Parse progress from tempo download output
    // Example: "Downloading segment 5/100" or percentage patterns
    const segmentMatch = logLine.match(/segment\s+(\d+)\s*\/\s*(\d+)/i);
    if (segmentMatch && this.downloadProgress) {
      const current = parseInt(segmentMatch[1], 10);
      const total = parseInt(segmentMatch[2], 10);
      this.downloadProgress.downloadedBytes = current;
      this.downloadProgress.totalBytes = total;
    }

    // Parse percentage if available
    const percentMatch = logLine.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch && this.downloadProgress) {
      const percent = parseFloat(percentMatch[1]);
      this.downloadProgress.downloadedBytes = Math.floor(percent);
      this.downloadProgress.totalBytes = 100;
    }

    // Parse download speed if available
    const speedMatch = logLine.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)\/s/i);
    if (speedMatch && this.downloadProgress) {
      let speed = parseFloat(speedMatch[1]);
      const unit = speedMatch[2].toUpperCase();
      if (unit === 'GB') speed *= 1024 * 1024 * 1024;
      else if (unit === 'MB') speed *= 1024 * 1024;
      else if (unit === 'KB') speed *= 1024;
      this.downloadProgress.speedBytesPerSec = speed;
    }
  }

  async downloadSnapshot(): Promise<{ success: boolean; message: string }> {
    if (this.isDownloading) {
      return { success: false, message: 'Download already in progress' };
    }

    const status = await this.dockerService.getStatus();
    if (status === 'running') {
      return { success: false, message: 'Please stop the node before downloading a snapshot' };
    }

    this.isDownloading = true;
    this.lastLogLine = 'Starting download...';
    this.downloadProgress = {
      snapshotId: 'latest',
      status: 'downloading' as DownloadStatus,
      downloadedBytes: 0,
      totalBytes: 100,
      speedBytesPerSec: 0,
      estimatedTimeRemaining: 0,
    };

    // Create download record in database
    this.currentDownloadId = await this.databaseService.createSnapshotDownload();

    try {
      this.logger.log('Starting Tempo snapshot download...');

      const result = await this.dockerService.runDownloadCommand(logLine => {
        this.updateProgress(logLine);
      });

      this.downloadProgress.status = 'completed';
      this.downloadProgress.downloadedBytes = 100;
      this.lastLogLine = 'Download completed!';
      this.isDownloading = false;

      // Mark download as completed in database
      if (this.currentDownloadId) {
        await this.databaseService.completeSnapshotDownload(this.currentDownloadId);
      }
      this.currentDownloadId = null;

      return { success: true, message: result };
    } catch (error) {
      this.logger.error('Snapshot download failed:', error);
      this.downloadProgress.status = 'error';
      const errorMsg = error instanceof Error ? error.message : 'Download failed';
      this.downloadProgress.error = errorMsg;
      this.lastLogLine = `Error: ${errorMsg}`;
      this.isDownloading = false;

      // Mark download as failed in database
      if (this.currentDownloadId) {
        await this.databaseService.failSnapshotDownload(this.currentDownloadId, errorMsg);
      }
      this.currentDownloadId = null;

      return {
        success: false,
        message: errorMsg,
      };
    }
  }

  async getDownloadHistory(): Promise<SnapshotDownloadHistory[]> {
    const history = await this.databaseService.getSnapshotDownloadHistory();
    return history.map(h => ({
      id: h.id,
      status: h.status as 'completed' | 'failed',
      startedAt: h.startedAt.toISOString(),
      completedAt: h.completedAt?.toISOString() ?? null,
      error: h.error,
    }));
  }

  async getLastSuccessfulDownload(): Promise<SnapshotDownloadHistory | null> {
    const download = await this.databaseService.getLastSuccessfulDownload();
    if (!download) return null;
    return {
      id: download.id,
      status: download.status as 'completed' | 'failed',
      startedAt: download.startedAt.toISOString(),
      completedAt: download.completedAt?.toISOString() ?? null,
      error: download.error,
    };
  }

  async cancelDownload(): Promise<void> {
    this.isDownloading = false;
    this.downloadProgress = null;
    this.lastLogLine = '';
  }
}
