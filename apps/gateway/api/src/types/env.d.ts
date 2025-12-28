/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // Environment Variables
  TEMPO_RPC_URL: string;
  PASSKEY_REGISTRY_ADDRESS: string;
  ALLOWED_ORIGINS: string;
  JWT_EXPIRATION: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
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
}
