/**
 * Connected Apps Storage
 * Manages the list of apps that have been granted permission to connect
 */

import { STORAGE_KEYS } from './constants';
import type { ConnectedApp, AppPermission } from '@/types';

/**
 * Get all connected apps
 */
export function getConnectedApps(): ConnectedApp[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONNECTED_APPS);
    if (!data) return [];
    return JSON.parse(data) as ConnectedApp[];
  } catch {
    return [];
  }
}

/**
 * Get a connected app by ID (origin URL)
 */
export function getConnectedApp(id: string): ConnectedApp | null {
  const apps = getConnectedApps();
  return apps.find(app => app.id === id) || null;
}

/**
 * Check if an app is connected
 */
export function isAppConnected(origin: string): boolean {
  const apps = getConnectedApps();
  return apps.some(app => app.id === origin || app.url === origin);
}

/**
 * Add or update a connected app
 */
export function saveConnectedApp(app: Omit<ConnectedApp, 'id'>): ConnectedApp {
  const apps = getConnectedApps();
  const id = new URL(app.url).origin;

  const existingIndex = apps.findIndex(a => a.id === id);
  const now = Date.now();

  const connectedApp: ConnectedApp = {
    ...app,
    id,
    connectedAt: existingIndex >= 0 ? apps[existingIndex].connectedAt : now,
    lastUsedAt: now,
  };

  if (existingIndex >= 0) {
    apps[existingIndex] = connectedApp;
  } else {
    apps.push(connectedApp);
  }

  localStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(apps));
  return connectedApp;
}

/**
 * Update app's last used timestamp
 */
export function updateAppLastUsed(id: string): void {
  const apps = getConnectedApps();
  const index = apps.findIndex(app => app.id === id);

  if (index >= 0) {
    apps[index].lastUsedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(apps));
  }
}

/**
 * Update app permissions
 */
export function updateAppPermissions(id: string, permissions: AppPermission[]): void {
  const apps = getConnectedApps();
  const index = apps.findIndex(app => app.id === id);

  if (index >= 0) {
    apps[index].permissions = permissions;
    apps[index].lastUsedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(apps));
  }
}

/**
 * Remove a connected app (revoke access)
 */
export function removeConnectedApp(id: string): void {
  const apps = getConnectedApps();
  const filtered = apps.filter(app => app.id !== id);
  localStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(filtered));
}

/**
 * Clear all connected apps
 */
export function clearConnectedApps(): void {
  localStorage.removeItem(STORAGE_KEYS.CONNECTED_APPS);
}

/**
 * Check if app has a specific permission
 */
export function hasPermission(origin: string, permission: AppPermission): boolean {
  const apps = getConnectedApps();
  const app = apps.find(a => a.id === origin || a.url === origin);
  if (!app) return false;
  return app.permissions.includes(permission);
}
