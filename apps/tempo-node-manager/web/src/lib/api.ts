import type {
  LoginRequest,
  LoginResponse,
  SetupStatus,
  ChangePasswordRequest,
  NodeInfo,
  NodeActionResponse,
  SyncStatus,
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
  getStatus: (): Promise<SetupStatus> => request<SetupStatus>('/auth/status'),

  setup: (password: string): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password } as LoginRequest),
    }),

  login: (password: string): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password } as LoginRequest),
    }),

  verify: (): Promise<{ valid: boolean }> => request<{ valid: boolean }>('/auth/verify'),

  changePassword: (currentPassword: string, newPassword: string): Promise<{ success: boolean }> =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword } as ChangePasswordRequest),
    }),
};

// Node API
export const nodeApi = {
  getStatus: (): Promise<NodeInfo> => request<NodeInfo>('/node/status'),

  getSyncStatus: (): Promise<SyncStatus> => request<SyncStatus>('/node/sync'),

  start: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/start', { method: 'POST' }),

  stop: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/stop', { method: 'POST' }),

  restart: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/restart', { method: 'POST' }),

  pullImage: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/pull', { method: 'POST' }),
};

// Logs API
export const logsApi = {
  getLogs: (limit = 100): Promise<LogEntry[]> =>
    request<LogEntry[]>(`/logs?limit=${limit}`),
};

// Snapshots API
export const snapshotsApi = {
  getStatus: (): Promise<{ isDownloading: boolean; progress: number; lastLog: string }> =>
    request<{ isDownloading: boolean; progress: number; lastLog: string }>('/snapshots/status'),

  getProgress: (): Promise<SnapshotDownloadProgress | null> =>
    request<SnapshotDownloadProgress | null>('/snapshots/progress'),

  download: (): Promise<{ success: boolean; message: string }> =>
    request<{ success: boolean; message: string }>('/snapshots/download', {
      method: 'POST',
    }),

  cancel: (): Promise<{ success: boolean }> =>
    request<{ success: boolean }>('/snapshots/cancel', { method: 'POST' }),
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
  getVersion: (): Promise<{ version: string }> => request<{ version: string }>('/update/version'),

  // Check for updates
  checkForUpdates: (): Promise<VersionInfo> => request<VersionInfo>('/update/check'),

  // Install update
  installUpdate: (): Promise<UpdateResult> =>
    request<UpdateResult>('/update/install', { method: 'POST' }),

  // Restart service
  restart: (): Promise<{ success: boolean; message: string }> =>
    request<{ success: boolean; message: string }>('/update/restart', {
      method: 'POST',
    }),
};
