import { Injectable, Logger } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import {
  NodeInfo,
  NodeActionResponse,
  SyncStatus,
} from '@temporium/tempo-node-types';

@Injectable()
export class NodeService {
  private readonly logger = new Logger(NodeService.name);

  constructor(private dockerService: DockerService) {}

  async getNodeInfo(): Promise<NodeInfo> {
    const status = await this.dockerService.getStatus();
    const containerId = await this.dockerService.getContainerId();
    const startedAt = await this.dockerService.getContainerStartTime();
    const config = this.dockerService.getConfig();

    let syncStatus: SyncStatus | undefined;
    let uptime: number | undefined;

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
      version: config.version,
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
      let isSynced = true;
      let syncProgress = 100;

      if (syncData.result && typeof syncData.result === 'object') {
        highestBlock = parseInt(syncData.result.highestBlock, 16);
        isSynced = false;
        syncProgress =
          highestBlock > 0
            ? Math.floor((currentBlock / highestBlock) * 100)
            : 0;
      }

      return {
        currentBlock,
        highestBlock,
        peerCount,
        isSynced,
        syncProgress,
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
        message:
          error instanceof Error ? error.message : 'Failed to restart node',
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
}
