const AUTH_STORAGE_KEY = 'temporium_auth';

export interface AuthToken {
  accessToken: string;
  expiresIn: number;
  expiresAt: number;
}

export function saveAuthToken(token: Omit<AuthToken, 'expiresAt'>): void {
  const authData: AuthToken = {
    ...token,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

export function getAuthToken(): AuthToken | null {
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as AuthToken;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  if (Date.now() >= token.expiresAt - 60000) return null;
  return token.accessToken;
}

export function isAccessTokenExpired(): boolean {
  const token = getAuthToken();
  if (!token) return true;
  return Date.now() >= token.expiresAt - 60000;
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Aliases
export const saveAuthTokens = saveAuthToken;
export const getAuthTokens = getAuthToken;
export const clearAuthTokens = clearAuthToken;
