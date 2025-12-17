import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SnapshotsService } from './snapshots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SnapshotDownloadProgress } from '#types/index';

@Controller('snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private snapshotsService: SnapshotsService) {}

  /**
   * Get current download progress
   */
  @Get('progress')
  async getProgress(): Promise<SnapshotDownloadProgress | null> {
    return this.snapshotsService.getDownloadProgress();
  }

  /**
   * Check if download is in progress with details
   */
  @Get('status')
  async getStatus(): Promise<{
    isDownloading: boolean;
    progress: number;
    lastLog: string;
  }> {
    const progress = await this.snapshotsService.getDownloadProgress();
    const percent =
      progress && progress.totalBytes > 0
        ? Math.round((progress.downloadedBytes / progress.totalBytes) * 100)
        : 0;

    return {
      isDownloading: this.snapshotsService.isDownloadInProgress(),
      progress: percent,
      lastLog: this.snapshotsService.getLastLogLine(),
    };
  }

  /**
   * Start downloading the latest snapshot
   */
  @Post('download')
  @HttpCode(HttpStatus.OK)
  async downloadSnapshot(): Promise<{ success: boolean; message: string }> {
    return this.snapshotsService.downloadSnapshot();
  }

  /**
   * Cancel current download
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelDownload(): Promise<{ success: boolean }> {
    await this.snapshotsService.cancelDownload();
    return { success: true };
  }
}
