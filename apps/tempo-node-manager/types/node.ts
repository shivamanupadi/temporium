/**
 * Tempo Node Status
 */
export type NodeStatus =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'syncing'
  | 'error'
  | 'not_installed';

/**
 * Sync status information
 */
export interface SyncStatus {
  currentBlock: number;
  highestBlock: number;
  peerCount: number;
  isSynced: boolean;
  syncProgress: number; // 0-100 percentage
}

/**
 * Node configuration
 */
export interface NodeConfig {
  version: string;
  dataDir: string;
  httpPort: number;
  p2pPort: number;
  httpApis: string[];
}

/**
 * Complete node information
 */
export interface NodeInfo {
  status: NodeStatus;
  containerId?: string;
  containerName: string;
  version: string;
  syncStatus?: SyncStatus;
  config: NodeConfig;
  startedAt?: string;
  uptime?: number; // seconds
}

/**
 * Node action response
 */
export interface NodeActionResponse {
  success: boolean;
  message: string;
  containerId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_NODE_CONFIG: NodeConfig = {
  version: 'latest',
  dataDir: '/var/lib/tempo',
  httpPort: 8545,
  p2pPort: 30303,
  httpApis: ['eth', 'net', 'web3', 'txpool', 'trace'],
};

export const TEMPO_IMAGE = 'ghcr.io/tempoxyz/tempo';
export const CONTAINER_NAME = 'tempo-node';
