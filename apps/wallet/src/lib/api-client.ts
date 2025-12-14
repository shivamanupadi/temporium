/**
 * API Client - Centralized fetch wrapper with JWT authentication
 * Automatically adds Authorization header and handles token refresh
 */

import { getApiBaseUrl } from './api';
import {
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
  clearAuthTokens,
  isAccessTokenExpired,
} from './auth-storage';

const API_BASE_URL = getApiBaseUrl();

interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearAuthTokens();
      return false;
    }

    const tokens = await response.json();
    saveAuthTokens(tokens);
    return true;
  } catch {
    clearAuthTokens();
    return false;
  }
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Check if token needs refresh
  if (isAccessTokenExpired()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new ApiClientError('Session expired. Please sign in again.', 401);
    }
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new ApiClientError('Not authenticated', 401);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  // Handle 401 - try to refresh token once
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const newToken = getAccessToken();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.text();
        throw new ApiClientError(error || 'Request failed', retryResponse.status);
      }

      return {
        data: await retryResponse.json(),
        status: retryResponse.status,
      };
    }

    clearAuthTokens();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new ApiClientError(error || 'Request failed', response.status);
  }

  return {
    data: await response.json(),
    status: response.status,
  };
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

// Convenience methods for common HTTP verbs

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiRequest<T>(endpoint, { method: 'GET' });
  return response.data;
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.data;
}

export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.data;
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await apiRequest<T>(endpoint, { method: 'DELETE' });
  return response.data;
}
