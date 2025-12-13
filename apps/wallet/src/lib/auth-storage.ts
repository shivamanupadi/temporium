/**
 * Auth Storage - JWT token persistence
 * Stores tokens in localStorage for persistence across page reloads
 */

const AUTH_STORAGE_KEY = 'tollr_auth';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number; // Unix timestamp when access token expires
}

/**
 * Save auth tokens to storage
 */
export function saveAuthTokens(tokens: Omit<AuthTokens, 'expiresAt'>): void {
  const authData: AuthTokens = {
    ...tokens,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

/**
 * Get auth tokens from storage
 */
export function getAuthTokens(): AuthTokens | null {
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as AuthTokens;
  } catch {
    return null;
  }
}

/**
 * Get access token if valid
 */
export function getAccessToken(): string | null {
  const tokens = getAuthTokens();
  if (!tokens) return null;

  // Check if token is expired (with 60 second buffer)
  if (Date.now() >= tokens.expiresAt - 60000) {
    return null;
  }

  return tokens.accessToken;
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  const tokens = getAuthTokens();
  return tokens?.refreshToken ?? null;
}

/**
 * Check if access token is expired or about to expire
 */
export function isAccessTokenExpired(): boolean {
  const tokens = getAuthTokens();
  if (!tokens) return true;

  // Consider expired if within 60 seconds of expiry
  return Date.now() >= tokens.expiresAt - 60000;
}

/**
 * Clear auth tokens
 */
export function clearAuthTokens(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
