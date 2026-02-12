/**
 * API Configuration for Gateway v1
 */

import { TEMPO_NETWORK } from './constants';
export { TEMPO_NETWORK };

const API_URL = import.meta.env.VITE_GATEWAY_V1_API_URL || 'http://localhost:4008';

export const KEYS_API_URL = `${API_URL}/keys`;

export const AUTH_API_URL = `${API_URL}/auth`;

export const TOKENLIST_API_URL = `${API_URL}/tokenlist`;

export function getGatewayApiUrl(): string {
  return API_URL;
}

/** @deprecated Use getGatewayApiUrl() */
export function getWalletApiUrl(): string {
  return API_URL;
}
