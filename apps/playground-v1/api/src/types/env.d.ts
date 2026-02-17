import type { Chain } from 'viem';

export interface NetworkConfig {
  network: 'testnet' | 'mainnet';
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string;
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  JWT_EXPIRATION: string;
  JWT_SECRET: string;
}

export interface JwtPayload {
  walletAddress: string;
  sub: string;
  iat: number;
  exp: number;
}

export interface Variables {
  user: JwtPayload;
  requestId: string;
  networkConfig: NetworkConfig;
}
