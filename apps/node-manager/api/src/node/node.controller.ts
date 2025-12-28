import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { NodeService, SnapshotDownloadStatus } from './node.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NodeInfo, NodeActionResponse, SyncStatus } from '#types/index';

@Controller('node')
@UseGuards(JwtAuthGuard)
export class NodeController {
  constructor(private nodeService: NodeService) {}

  /**
   * Get node status and information
   */
  @Get('status')
  async getStatus(): Promise<NodeInfo> {
    return this.nodeService.getNodeInfo();
  }

  /**
   * Get sync status
   */
  @Get('sync')
  async getSyncStatus(): Promise<SyncStatus> {
    return this.nodeService.getSyncStatus();
  }

  /**
   * Start the node
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async start(): Promise<NodeActionResponse> {
    return this.nodeService.startNode();
  }

  /**
   * Stop the node
   */
  @Post('stop')
  @HttpCode(HttpStatus.OK)
  async stop(): Promise<NodeActionResponse> {
    return this.nodeService.stopNode();
  }

  /**
   * Restart the node
   */
  @Post('restart')
  @HttpCode(HttpStatus.OK)
  async restart(): Promise<NodeActionResponse> {
    return this.nodeService.restartNode();
  }

  /**
   * Pull latest Docker image
   */
  @Post('pull')
  @HttpCode(HttpStatus.OK)
  async pullImage(): Promise<NodeActionResponse> {
    return this.nodeService.pullImage();
  }

  /**
   * Get snapshot download status
   */
  @Get('snapshot/status')
  getSnapshotStatus(): SnapshotDownloadStatus {
    return this.nodeService.getSnapshotStatus();
  }

  /**
   * Start snapshot download
   */
  @Post('snapshot/download')
  @HttpCode(HttpStatus.OK)
  async downloadSnapshot(): Promise<NodeActionResponse> {
    return this.nodeService.downloadSnapshot();
  }

  /**
   * Delete the container
   */
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async deleteContainer(): Promise<NodeActionResponse> {
    return this.nodeService.deleteContainer();
  }
}
