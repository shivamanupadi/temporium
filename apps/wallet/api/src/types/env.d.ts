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

  // Platform fees — dormant at launch; flip to enable per feature
  PLATFORM_FEE_PAYMENT_LINK_BPS: string; // payment links fee in basis points, e.g. "100" for 1%
  PLATFORM_FEE_SCHEDULE_TXN_AMOUNT: string; // flat fee for scheduled payments in token decimal units, e.g. "0.1"
  PLATFORM_FEE_SWAP_AMOUNT: string; // flat fee for swaps in token decimal units, e.g. "0.1"
  PLATFORM_REVENUE_ADDRESS: string; // fee recipient (shared across networks & features)

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
