/**
 * API Client - Centralized fetch wrapper with JWT authentication
 * Simple JWT with 24hr expiry - when expired, user re-authenticates with passkey
 */

import { getGatewayApiUrl } from './api';
import { getAccessToken, clearAuthToken, isAccessTokenExpired } from './auth-storage';

const GATEWAY_API_URL = getGatewayApiUrl();

interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Standard API response format from hono-api
 */
interface StandardApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Check if response follows standard format
 */
function isStandardResponse<T>(data: unknown): data is StandardApiResponse<T> {
  return typeof data === 'object' && data !== null && 'success' in data && 'data' in data;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Check if token is expired
  if (isAccessTokenExpired()) {
    clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new ApiClientError('Not authenticated', 401);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${GATEWAY_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  // Handle 401 - token invalid or expired
  if (response.status === 401) {
    clearAuthToken();
    throw new ApiClientError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.error?.message || errorBody?.message || 'Request failed';
    throw new ApiClientError(message, response.status);
  }

  // Handle 204 No Content (for deletes)
  if (response.status === 204) {
    return {
      data: undefined as T,
      status: response.status,
    };
  }

  const json = await response.json();

  // Unwrap standard response format { success: true, data: T }
  const data = isStandardResponse<T>(json) ? json.data : json;

  return {
    data,
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
