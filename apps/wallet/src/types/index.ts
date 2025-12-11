import type { Address } from 'viem';

// Common modal state for transaction flows (confirm -> pending -> success)
export type TransactionModalState = 'confirm' | 'pending' | 'success' | null;

// Token role types for TIP-20 stablecoins
export type TokenRole = 'issuer' | 'pause' | 'unpause' | 'burnBlocked' | 'defaultAdmin';

// Role option for UI display
export interface RoleOption {
  value: TokenRole;
  label: string;
  description: string;
}

// Currency option for stablecoin creation
export interface CurrencyOption {
  value: string;
  label: string;
}

// Contact type
export interface Contact {
  id: string;
  name: string;
  address: Address;
  createdAt: number;
  updatedAt: number;
}

// Scheduled transaction status
export type ScheduledTransactionStatus = 'pending' | 'executed' | 'failed';
