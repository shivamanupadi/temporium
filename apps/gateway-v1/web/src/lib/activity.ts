import type { ActivityItem, ActivityType, ActivityStatus } from '@/types';

const STORAGE_KEY = 'temporium_activity';
const MAX_ITEMS = 100;

/**
 * Get all activity items
 */
export function getActivity(): ActivityItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ActivityItem[];
  } catch {
    return [];
  }
}

/**
 * Add a new activity item
 */
export function addActivity(item: Omit<ActivityItem, 'id' | 'timestamp'>): ActivityItem {
  const activity: ActivityItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  const items = getActivity();
  items.unshift(activity);

  const trimmed = items.slice(0, MAX_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    const reduced = trimmed.slice(0, MAX_ITEMS / 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
  }

  return activity;
}

/**
 * Clear all activity
 */
export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get activity for a specific app
 */
export function getActivityByApp(appUrl: string): ActivityItem[] {
  return getActivity().filter(item => item.appUrl === appUrl);
}

/**
 * Get display label for activity type
 */
export function getActivityTypeLabel(type: ActivityType): string {
  switch (type) {
    case 'connect':
      return 'Connected';
    case 'sign_message':
      return 'Signed Message';
    case 'sign_transaction':
      return 'Sign Transaction';
    case 'send_transaction':
      return 'Transaction';
    default:
      return 'Unknown';
  }
}

/**
 * Get color class for activity status
 */
export function getActivityStatusColor(status: ActivityStatus): string {
  switch (status) {
    case 'success':
      return 'text-[#5B9A6F] bg-[#5B9A6F]/8';
    case 'failed':
      return 'text-red-500 bg-red-500/8';
    case 'rejected':
      return 'text-amber-500 bg-amber-500/8';
    case 'timeout':
      return 'text-[#9B9590] bg-[#F5F2ED]';
    default:
      return 'text-[#9B9590] bg-[#F5F2ED]';
  }
}
