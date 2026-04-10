import { Storage } from 'accounts';

export interface AuthToken {
  accessToken: string;
  expiresIn: number;
  expiresAt: number;
}

/**
 * Auth token storage backed by accounts SDK Storage.
 * Uses combined IDB + localStorage for resilience — reads return
 * first non-null result, writes propagate to both.
 */
const storage = Storage.combine(
  Storage.idb({ key: 'temporium' }),
  Storage.localStorage({ key: 'temporium' })
);

const AUTH_KEY = 'auth';

export async function saveAuthToken(token: Omit<AuthToken, 'expiresAt'>): Promise<void> {
  const authData: AuthToken = {
    ...token,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
  await storage.setItem(AUTH_KEY, authData);
  // Mirror to raw localStorage for cross-tab detection via StorageEvent
  localStorage.setItem('temporium_auth', JSON.stringify(authData));
}

export async function getAuthToken(): Promise<AuthToken | null> {
  try {
    const data = await storage.getItem<AuthToken>(AUTH_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;
  if (Date.now() >= token.expiresAt - 60000) return null;
  return token.accessToken;
}

export async function isAccessTokenExpired(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return true;
  return Date.now() >= token.expiresAt - 60000;
}

export async function clearAuthToken(): Promise<void> {
  await storage.removeItem(AUTH_KEY);
  localStorage.removeItem('temporium_auth');
}

// Aliases
export const saveAuthTokens = saveAuthToken;
export const getAuthTokens = getAuthToken;
export const clearAuthTokens = clearAuthToken;
