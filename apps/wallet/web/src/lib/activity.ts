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

  // Keep only the most recent items
  const trimmed = items.slice(0, MAX_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full - clear old items and try again
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
 * Get activity filtered by type
 */
export function getActivityByType(type: ActivityType): ActivityItem[] {
  return getActivity().filter(item => item.type === type);
}

/**
 * Get activity filtered by status
 */
export function getActivityByStatus(status: ActivityStatus): ActivityItem[] {
  return getActivity().filter(item => item.status === status);
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
    case 'send_payment':
      return 'Payment';
    case 'send_scheduled_payment':
      return 'Scheduled Payment';
    case 'swap_tokens':
      return 'Token Swap';
    case 'add_liquidity':
      return 'Add Liquidity';
    case 'remove_liquidity':
      return 'Remove Liquidity';
    case 'send_transaction':
      return 'Transaction';
    case 'buy_tokens':
      return 'Buy Tokens';
    case 'place_order':
      return 'Place Order';
    case 'cancel_order':
      return 'Cancel Order';
    case 'create_pair':
      return 'Create Pair';
    case 'approve_token':
      return 'Approve Token';
    case 'create_token':
      return 'Create Token';
    case 'mint_token':
      return 'Mint Token';
    case 'burn_token':
      return 'Burn Token';
    case 'claim_rewards':
      return 'Claim Rewards';
    case 'dex_withdraw':
      return 'DEX Withdraw';
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
      return 'text-green-600 bg-green-50';
    case 'failed':
      return 'text-red-600 bg-red-50';
    case 'rejected':
      return 'text-amber-600 bg-amber-50';
    case 'timeout':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}
