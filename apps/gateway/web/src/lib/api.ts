/**
 * API Configuration
 * All API URLs are derived from a single base URL
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Keys API URL - for passkey storage
 */
export const KEYS_API_URL = `${API_BASE_URL}/keys`;

/**
 * Auth API URL - for SIWE authentication
 */
export const AUTH_API_URL = `${API_BASE_URL}/v1/auth`;

/**
 * Tokenlist API URL - proxied to avoid CORS
 */
export const TOKENLIST_API_URL = `${API_BASE_URL}/tokenlist`;

/**
 * Get the base API URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
