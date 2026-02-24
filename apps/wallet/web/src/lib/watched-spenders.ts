import { apiGet, apiPost, apiDelete } from './api-client';

export interface WatchedSpender {
  id: string;
  owner: string;
  address: string;
  label: string | null;
  createdAt: string;
}

export function getWatchedSpenders(): Promise<WatchedSpender[]> {
  return apiGet<WatchedSpender[]>('/v1/watched-spenders');
}

export function addWatchedSpender(address: string, label?: string): Promise<WatchedSpender> {
  return apiPost<WatchedSpender>('/v1/watched-spenders', { address, label });
}

export function deleteWatchedSpender(id: string): Promise<void> {
  return apiDelete<void>(`/v1/watched-spenders/${id}`);
}
