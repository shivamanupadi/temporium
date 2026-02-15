import type { Chain } from 'viem';

/**
 * Per-request network configuration resolved from X-Tempo-Network header
 */
export interface NetworkConfig {
  network: 'testnet' | 'mainnet';
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string;
  passkeyRegistryAddress: string;
  relayerPrivateKey: string;
}

/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // Durable Objects
  SCHEDULED_TX: DurableObjectNamespace;

  // Environment Variables
  ALLOWED_ORIGINS: string;

  // JWT config (shared across networks)
  JWT_EXPIRATION: string;

  // Per-network passkey registry addresses
  TESTNET_PASSKEY_REGISTRY_ADDRESS: string;
  MAINNET_PASSKEY_REGISTRY_ADDRESS: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  TESTNET_RELAYER_PRIVATE_KEY: string;
  MAINNET_RELAYER_PRIVATE_KEY: string;
}

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  walletAddress: string;
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Hono context variables
 */
export interface Variables {
  user: JwtPayload;
  db: import('../db').Database;
  requestId: string;
  networkConfig: NetworkConfig;
}
