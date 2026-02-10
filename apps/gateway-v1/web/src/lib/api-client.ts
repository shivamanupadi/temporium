import { getAccessToken, isAccessTokenExpired, clearAuthToken } from './auth-storage';
import { getGatewayApiUrl } from './api';

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
  if (isAccessTokenExpired()) {
    clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  const accessToken = getAccessToken();
  const url = `${getGatewayApiUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiClientError(text || `Request failed (${response.status})`, response.status);
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
