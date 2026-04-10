/**
 * API Configuration for Wallet
 */

import { TEMPO_NETWORK } from './constants';
export { TEMPO_NETWORK };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8008';

export const KEYS_API_URL = `${API_URL}/keys`;

export const AUTH_API_URL = `${API_URL}/auth`;

export const TOKENLIST_API_URL = `${API_URL}/tokenlist`;

export function getWalletApiUrl(): string {
  return API_URL;
}
