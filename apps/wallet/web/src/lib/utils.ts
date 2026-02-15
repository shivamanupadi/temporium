import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatAmount(amount: string | bigint, decimals = 6, displayDecimals = 2): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  const fractionStr = fraction.toString().padStart(decimals, '0');
  const displayFraction = fractionStr.slice(0, displayDecimals);

  const wholeFormatted = whole.toLocaleString();

  if (displayDecimals === 0) return wholeFormatted;
  return `${wholeFormatted}.${displayFraction}`;
}

export function parseAmount(value: string, decimals = 6): bigint {
  if (!value || value === '.') return 0n;

  const cleanValue = value.replace(/,/g, '');
  const [whole = '0', fraction = ''] = cleanValue.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString();
}

export function formatCountdown(targetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  let remaining = targetTimestamp - now;

  if (remaining <= 0) return 'Now';

  const units: [string, number][] = [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  const parts: string[] = [];
  for (const [label, size] of units) {
    if (remaining >= size) {
      const count = Math.floor(remaining / size);
      parts.push(`${count}${label}`);
      remaining -= count * size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(' ') || '0s';
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

const MAX_UINT128 = 2n ** 128n - 1n;

export function isUnlimitedSupply(value: bigint | undefined): boolean {
  if (!value) return false;
  return value >= MAX_UINT128 - 1000n;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const modalAnimation = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
  content: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.15 },
  },
} as const;
