import { Controller, Get } from '@nestjs/common';
import { NodeService } from './node.service';

export interface PublicNodeStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'syncing' | 'error' | 'not_installed';
  currentBlock: number;
  highestBlock: number;
  peerCount: number;
  isSynced: boolean;
  syncProgress: number;
  uptime?: number;
  version: string;
}

@Controller('public')
export class PublicStatusController {
  constructor(private nodeService: NodeService) {}

  /**
   * Get public node status (no authentication required)
   */
  @Get('status')
  async getPublicStatus(): Promise<PublicNodeStatus> {
    const nodeInfo = await this.nodeService.getNodeInfo();

    return {
      status: nodeInfo.status,
      currentBlock: nodeInfo.syncStatus?.currentBlock ?? 0,
      highestBlock: nodeInfo.syncStatus?.highestBlock ?? 0,
      peerCount: nodeInfo.syncStatus?.peerCount ?? 0,
      isSynced: nodeInfo.syncStatus?.isSynced ?? false,
      syncProgress: nodeInfo.syncStatus?.syncProgress ?? 0,
      uptime: nodeInfo.uptime,
      version: nodeInfo.version,
    };
  }
}
