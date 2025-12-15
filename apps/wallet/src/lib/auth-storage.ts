/**
 * Auth Storage - JWT token persistence
 * Stores tokens in localStorage for persistence across page reloads
 * Simple JWT with 24hr expiry - when expired, user re-authenticates with passkey
 */

const AUTH_STORAGE_KEY = 'tollr_auth';

export interface AuthToken {
  accessToken: string;
  expiresIn: number;
  expiresAt: number; // Unix timestamp when access token expires
}

/**
 * Save auth token to storage
 */
export function saveAuthToken(token: Omit<AuthToken, 'expiresAt'>): void {
  const authData: AuthToken = {
    ...token,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

/**
 * Get auth token from storage
 */
export function getAuthToken(): AuthToken | null {
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as AuthToken;
  } catch {
    return null;
  }
}

/**
 * Get access token if valid
 */
export function getAccessToken(): string | null {
  const token = getAuthToken();
  if (!token) return null;

  // Check if token is expired (with 60 second buffer)
  if (Date.now() >= token.expiresAt - 60000) {
    return null;
  }

  return token.accessToken;
}

/**
 * Check if access token is expired or about to expire
 */
export function isAccessTokenExpired(): boolean {
  const token = getAuthToken();
  if (!token) return true;

  // Consider expired if within 60 seconds of expiry
  return Date.now() >= token.expiresAt - 60000;
}

/**
 * Clear auth token (logout)
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Legacy aliases for backwards compatibility during migration
export const saveAuthTokens = saveAuthToken;
export const getAuthTokens = getAuthToken;
export const clearAuthTokens = clearAuthToken;
