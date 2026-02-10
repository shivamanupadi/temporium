import type { Address } from 'viem';

/**
 * Wallet connection type
 */
export type WalletType = 'passkey' | 'injected' | 'wallet-connect' | null;

/**
 * Contact
 */
export interface Contact {
  id: string;
  name: string;
  address: Address;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * TIP20 Contract
 */
export interface Tip20Contract {
  id: string;
  address: Address;
  name: string;
  symbol: string;
  currency: string;
  admin?: Address;
  createdAt: string;
  updatedAt: string;
}

/**
 * Scheduled Transaction
 */
export interface ScheduledTransaction {
  id: string;
  to: Address;
  amount: string;
  token: Address;
  tokenSymbol: string;
  memo?: string;
  scheduledFor: number;
  txHash?: string;
  status: 'pending' | 'executed' | 'failed' | 'expired';
  createdAt: string;
}

/**
 * Policy
 */
export interface Policy {
  id: string;
  name: string;
  address?: Address;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicyRule {
  type: string;
  params: Record<string, unknown>;
}

/**
 * Token from token list
 */
export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}
