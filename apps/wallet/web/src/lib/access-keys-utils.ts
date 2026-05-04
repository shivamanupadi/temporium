import { Account, Secp256k1 as TempoSecp256k1, P256 as TempoP256 } from 'viem/tempo';
import type { Address, Hex } from 'viem';
import type { AccessKeyType } from '@/types';

/** Generated Secp256k1 key pair */
export interface Secp256k1KeyPair {
  type: 'secp256k1';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

/** Generated P256 key pair */
export interface P256KeyPair {
  type: 'p256';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

export type GeneratedKey = Secp256k1KeyPair | P256KeyPair;

/**
 * Generate a random Secp256k1 key pair.
 * Uses viem/tempo Account.fromSecp256k1 for key derivation.
 */
export function generateSecp256k1Key(): Secp256k1KeyPair {
  const privateKey = TempoSecp256k1.randomPrivateKey();
  const account = Account.fromSecp256k1(privateKey);

  return {
    type: 'secp256k1',
    privateKey,
    publicKey: account.publicKey,
    keyId: account.address,
  };
}

/**
 * Generate a random P256 key pair.
 * Uses viem/tempo Account.fromP256 for key derivation.
 */
export function generateP256Key(): P256KeyPair {
  const privateKey = TempoP256.randomPrivateKey();
  const account = Account.fromP256(privateKey);

  return {
    type: 'p256',
    privateKey,
    publicKey: account.publicKey,
    keyId: account.address,
  };
}

/** Get signature type number for on-chain usage */
export function getSignatureTypeNumber(type: AccessKeyType): number {
  switch (type) {
    case 'secp256k1':
      return 0;
    case 'p256':
      return 1;
    case 'webAuthn':
      return 2;
    default:
      throw new Error(`Unknown key type: ${type}`);
  }
}

/** Get signature type label from on-chain number */
export function getSignatureTypeLabel(typeNumber: number): AccessKeyType {
  switch (typeNumber) {
    case 0:
      return 'secp256k1';
    case 1:
      return 'p256';
    case 2:
      return 'webAuthn';
    default:
      throw new Error(`Unknown signature type number: ${typeNumber}`);
  }
}

/** Format expiry timestamp for display */
export function formatExpiry(expiry: number): string {
  if (expiry === 0) return 'Never';

  const date = new Date(expiry * 1000);
  const now = Date.now();

  if (expiry * 1000 < now) {
    return 'Expired';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Check if a key is expired */
export function isKeyExpired(expiry: number): boolean {
  if (expiry === 0) return false;
  return expiry * 1000 < Date.now();
}

/** Get key status string */
export function getKeyStatus(isRevoked: boolean, expiry: number): 'active' | 'revoked' | 'expired' {
  if (isRevoked) return 'revoked';
  if (isKeyExpired(expiry)) return 'expired';
  return 'active';
}

// ============ Period helpers ============

/**
 * Predefined refresh periods for spending limits, in seconds.
 * 0 = one-time (legacy, limit never refreshes).
 */
export const SPENDING_PERIOD_PRESETS = [
  { label: 'One-time', seconds: 0 },
  { label: 'Per day', seconds: 86400 },
  { label: 'Per week', seconds: 604800 },
  { label: 'Per month', seconds: 2592000 },
] as const;

export type SpendingPeriodSeconds = (typeof SPENDING_PERIOD_PRESETS)[number]['seconds'];

/** Format a period in seconds to a human-readable string. */
export function formatPeriod(periodSeconds: number): string {
  if (periodSeconds === 0) return 'one-time';
  const preset = SPENDING_PERIOD_PRESETS.find(p => p.seconds === periodSeconds);
  if (preset) return preset.label.toLowerCase();
  if (periodSeconds < 3600) return `every ${periodSeconds}s`;
  if (periodSeconds < 86400) return `every ${Math.round(periodSeconds / 3600)}h`;
  return `every ${Math.round(periodSeconds / 86400)}d`;
}

/** Format a relative "last used" timestamp. */
export function formatLastUsed(lastUsedAt: string | Date | null | undefined): string {
  if (!lastUsedAt) return 'Never used';
  const ts = typeof lastUsedAt === 'string' ? new Date(lastUsedAt).getTime() : lastUsedAt.getTime();
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// ============ Selector helpers ============

/**
 * Common ERC-20 / wallet function selectors. Used to render human labels
 * in the restrictions UI without forcing the user to compute keccak256.
 */
export const COMMON_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x40c10f19': 'mint(address,uint256)',
  '0x42966c68': 'burn(uint256)',
  '0x9dc29fac': 'burn(address,uint256)',
} as const;

/** Get a friendly label for a 4-byte selector, or just the selector itself. */
export function selectorLabel(selector: `0x${string}` | string): string {
  return COMMON_SELECTORS[selector.toLowerCase()] ?? selector;
}
