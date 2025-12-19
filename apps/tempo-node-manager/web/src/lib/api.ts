import type {
  LoginRequest,
  LoginResponse,
  SetupStatus,
  ChangePasswordRequest,
  NodeInfo,
  NodeActionResponse,
  SyncStatus,
  LogEntry,
} from '#types/index';
import { useAuthStore } from '@/stores/auth';

// Use VITE_API_URL env var for remote agent, otherwise default to local
const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
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

// Snapshot status type
export interface SnapshotInfo {
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string | null;
}

export interface SnapshotDownloadStatus {
  isDownloading: boolean;
  progress: number;
  lastLog: string | null;
  snapshot: SnapshotInfo;
}

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

  deleteContainer: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/delete', { method: 'POST' }),

  // Snapshot methods
  getSnapshotStatus: (): Promise<SnapshotDownloadStatus> =>
    request<SnapshotDownloadStatus>('/node/snapshot/status'),

  downloadSnapshot: (): Promise<NodeActionResponse> =>
    request<NodeActionResponse>('/node/snapshot/download', { method: 'POST' }),
};

// Logs API
export const logsApi = {
  getLogs: (limit = 100): Promise<LogEntry[]> => request<LogEntry[]>(`/logs?limit=${limit}`),
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

// Public API (no auth required)
export interface PublicNodeStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'syncing' | 'error' | 'not_installed';
  currentBlock: number;
  highestBlock: number;
  peerCount: number;
  isSynced: boolean;
  syncProgress: number;
  uptime?: number;
  version: string;
}

export const publicApi = {
  getStatus: async (): Promise<PublicNodeStatus> => {
    const response = await fetch(`${API_BASE}/public/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch public status');
    }
    return response.json();
  },
};

// System API
export interface SystemInfo {
  cpu: {
    cores: number;
    model: string;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  storage: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    host: string;
  };
}

export interface RequirementCheck {
  name: string;
  current: number;
  currentFormatted: string;
  minimum: number;
  minimumFormatted: string;
  recommended: number;
  recommendedFormatted: string;
  meetsMinimum: boolean;
  meetsRecommended: boolean;
}

export interface SystemRequirements {
  meetsMinimum: boolean;
  meetsRecommended: boolean;
  checks: {
    cpu: RequirementCheck;
    memory: RequirementCheck;
    storage: RequirementCheck;
  };
}

export const systemApi = {
  getInfo: (): Promise<SystemInfo> => request<SystemInfo>('/system/info'),

  // Public endpoint (no auth required)
  checkRequirements: async (): Promise<SystemRequirements> => {
    const response = await fetch(`${API_BASE}/system/requirements`);
    if (!response.ok) {
      throw new Error('Failed to check system requirements');
    }
    return response.json();
  },
};

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
