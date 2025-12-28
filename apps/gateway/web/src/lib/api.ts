/**
 * API Configuration
 */

/**
 * Gateway API base URL
 */
const GATEWAY_API_URL = import.meta.env.VITE_GATEWAY_API_URL || 'https://gateway-api.temporium.xyz';

/**
 * Wallet API base URL (passkey storage & auth)
 */
const WALLET_API_URL = import.meta.env.VITE_WALLET_API_URL || 'https://wallet-api.temporium.xyz';

/**
 * Keys API URL - for passkey storage (wallet-api)
 */
export const KEYS_API_URL = `${WALLET_API_URL}/keys`;

/**
 * Auth API URL - for SIWE authentication (wallet-api)
 */
export const AUTH_API_URL = `${WALLET_API_URL}/auth`;

/**
 * Tokenlist API URL - proxied to avoid CORS (gateway-api)
 */
export const TOKENLIST_API_URL = `${GATEWAY_API_URL}/tokenlist`;

/**
 * Get the gateway API base URL
 */
export function getGatewayApiUrl(): string {
  return GATEWAY_API_URL;
}

/**
 * Get the wallet API base URL
 */
export function getWalletApiUrl(): string {
  return WALLET_API_URL;
}
