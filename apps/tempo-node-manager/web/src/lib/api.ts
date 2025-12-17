import type {
  LoginRequest,
  LoginResponse,
  SetupStatus,
  ChangePasswordRequest,
  NodeInfo,
  NodeActionResponse,
  SyncStatus,
  SystemMetrics,
  MetricsDataPoint,
  LogEntry,
  SnapshotDownloadProgress,
} from '@temporium/tempo-node-types';
import { useAuthStore } from '@/stores/auth';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Only set Content-Type for requests with body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  getStatus: () => request<SetupStatus>('/auth/status'),

  setup: (password: string) =>
    request<LoginResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password } as LoginRequest),
    }),

  login: (password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password } as LoginRequest),
    }),

  verify: () => request<{ valid: boolean }>('/auth/verify'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword } as ChangePasswordRequest),
    }),
};

// Node API
export const nodeApi = {
  getStatus: () => request<NodeInfo>('/node/status'),

  getSyncStatus: () => request<SyncStatus>('/node/sync'),

  start: () =>
    request<NodeActionResponse>('/node/start', { method: 'POST' }),

  stop: () =>
    request<NodeActionResponse>('/node/stop', { method: 'POST' }),

  restart: () =>
    request<NodeActionResponse>('/node/restart', { method: 'POST' }),

  pullImage: () =>
    request<NodeActionResponse>('/node/pull', { method: 'POST' }),
};

// Logs API
export const logsApi = {
  getLogs: (limit = 100) =>
    request<LogEntry[]>(`/logs?limit=${limit}`),
};

// Metrics API
export const metricsApi = {
  getCurrent: () => request<SystemMetrics>('/metrics'),

  getHistory: (limit = 100) =>
    request<MetricsDataPoint[]>(`/metrics/history?limit=${limit}`),
};

// Snapshots API
export const snapshotsApi = {
  getStatus: () => request<{ isDownloading: boolean; progress: number; lastLog: string }>('/snapshots/status'),

  getProgress: () =>
    request<SnapshotDownloadProgress | null>('/snapshots/progress'),

  download: () =>
    request<{ success: boolean; message: string }>('/snapshots/download', {
      method: 'POST',
    }),

  cancel: () =>
    request<{ success: boolean }>('/snapshots/cancel', { method: 'POST' }),
};

// Monitoring API (Prometheus + Grafana)
export interface MonitoringStatus {
  prometheusRunning: boolean;
  grafanaRunning: boolean;
  prometheusUrl: string;
  grafanaUrl: string;
}

export const monitoringApi = {
  getStatus: () => request<MonitoringStatus>('/monitoring/status'),

  start: () =>
    request<{ success: boolean; message: string }>('/monitoring/start', {
      method: 'POST',
    }),

  stop: () =>
    request<{ success: boolean; message: string }>('/monitoring/stop', {
      method: 'POST',
    }),
};

// Update API
export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checksum: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  lastChecked: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
}

export const updateApi = {
  // Get current version (no auth required)
  getVersion: () => request<{ version: string }>('/update/version'),

  // Check for updates
  checkForUpdates: () => request<VersionInfo>('/update/check'),

  // Install update
  installUpdate: () =>
    request<UpdateResult>('/update/install', { method: 'POST' }),

  // Restart service
  restart: () =>
    request<{ success: boolean; message: string }>('/update/restart', {
      method: 'POST',
    }),
};
