/**
 * Snapshot information
 */
export interface Snapshot {
  id: string;
  url: string;
  blockNumber: number;
  size: number; // bytes
  createdAt: string;
  checksum?: string;
}

/**
 * Snapshot download status
 */
export type DownloadStatus = 'idle' | 'downloading' | 'extracting' | 'completed' | 'error';

/**
 * Snapshot download progress
 */
export interface SnapshotDownloadProgress {
  snapshotId: string;
  status: DownloadStatus;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  estimatedTimeRemaining: number; // seconds
  error?: string;
}
