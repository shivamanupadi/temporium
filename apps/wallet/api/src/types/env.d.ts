import type { Chain } from 'viem';

/**
 * Per-request network configuration resolved from X-Tempo-Network header
 */
export interface NetworkConfig {
  network: 'testnet' | 'mainnet';
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string;
  recurringPaymentsAddress: string;
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
  RECURRING_PAYMENT: DurableObjectNamespace;

  // JWT config (shared across networks)
  JWT_EXPIRATION: string;

  // Passkey registry — identity is network-agnostic, always resolved on mainnet.
  PASSKEY_REGISTRY_CONTRACT: string;

  // Per-network recurring payments contract addresses
  RECURRING_PAYMENTS_TESTNET_CONTRACT: string;
  RECURRING_PAYMENTS_MAINNET_CONTRACT: string;

  // Payment links — platform fee (dormant at launch; flip to enable)
  PLATFORM_FEE_BPS: string; // basis points as string, e.g. "100" for 1%, "0" for dormant
  PLATFORM_REVENUE_ADDRESS: string; // fee recipient (shared across networks)

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  /**
   * HMAC secret that mppx uses to cryptographically bind issued challenges
   * to their contents for stateless verification. Must be stable across
   * instances — if it changes between the 402 issue and the credential
   * verify, mppx rejects the credential with an "invalid-challenge" error.
   */
  MPP_SECRET_KEY: string;
  /**
   * Relayer EOA used to sign recurring-payment executions and passkey
   * registry writes. Chain-agnostic — the same EOA signs for both
   * testnet and mainnet (chain ID lives in the tx payload, not the key).
   */
  RELAYER_PRIVATE_KEY: string;
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
