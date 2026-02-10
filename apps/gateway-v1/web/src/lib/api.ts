/**
 * API Configuration for Gateway v1
 */

const GATEWAY_API_URL = import.meta.env.VITE_GATEWAY_V1_API_URL || 'http://localhost:4008';

const WALLET_API_URL = import.meta.env.VITE_WALLET_API_URL || 'https://wallet-api.temporium.xyz';

export const KEYS_API_URL = `${WALLET_API_URL}/keys`;

export const AUTH_API_URL = `${WALLET_API_URL}/auth`;

export const TOKENLIST_API_URL = `${GATEWAY_API_URL}/tokenlist`;

export function getGatewayApiUrl(): string {
  return GATEWAY_API_URL;
}

export function getWalletApiUrl(): string {
  return WALLET_API_URL;
}
