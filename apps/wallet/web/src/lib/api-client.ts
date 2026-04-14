import { getAccessToken, isAccessTokenExpired, clearAuthToken } from './auth-storage';
import { getWalletApiUrl, TEMPO_NETWORK } from './api';

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (await isAccessTokenExpired()) {
    await clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  const accessToken = await getAccessToken();
  const url = `${getWalletApiUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tempo-Network': TEMPO_NETWORK,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    await clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
      else if (typeof parsed?.error === 'string') message = parsed.error;
    } catch {
      // not JSON - use raw text
    }
    throw new ApiClientError(message, response.status);
  }

  // 204 No Content (e.g. DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  const result = (await response.json()) as ApiResponse<T>;

  if (!result.success) {
    throw new ApiClientError(result.error || 'Request failed', response.status);
  }

  return result.data as T;
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint);
}

export function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}

/**
 * Auth-less version of apiRequest - used by public endpoints like the payer
 * view of a payment link. Still attaches `X-Tempo-Network` and parses the
 * standard `{ success, data, error }` envelope.
 */
export async function publicApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getWalletApiUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tempo-Network': TEMPO_NETWORK,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
      else if (typeof parsed?.error === 'string') message = parsed.error;
    } catch {
      // not JSON - use raw text
    }
    throw new ApiClientError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) {
    throw new ApiClientError(result.error || 'Request failed', response.status);
  }
  return result.data as T;
}
