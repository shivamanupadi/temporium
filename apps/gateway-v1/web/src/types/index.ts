import type { Address } from 'viem';

export * from './gateway-connect';

/**
 * Wallet connection type
 */
export type WalletType = 'passkey' | 'injected' | null;

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
  from: Address;
  to: Address;
  amount: string;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  feeToken: Address;
  memo?: string;
  scheduledFor: number;
  txHash?: string;
  status: 'pending' | 'executed' | 'failed';
  attempts: number;
  failReason?: string;
  createdAt: string;
  executedAt?: string;
}

/**
 * Policy (on-chain TIP403)
 */
export interface Policy {
  id: string;
  owner: string;
  policyId: string;
  type: PolicyType;
  admin: string;
  txHash?: string;
  createdAt: string;
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

/**
 * TIP20 token roles
 */
export type TokenRole = 'issuer' | 'pause' | 'unpause' | 'burnBlocked' | 'defaultAdmin';

/**
 * Policy type
 */
export type PolicyType = 'whitelist' | 'blacklist';

/**
 * On-chain token metadata
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  currency: string;
  decimals: number;
  paused?: boolean;
  supplyCap?: bigint;
  totalSupply: bigint;
  quoteToken?: Address;
  transferPolicyId?: bigint;
}

/**
 * Stablecoin with enriched on-chain metadata
 */
export interface StablecoinWithMetadata extends Tip20Contract {
  metadata?: TokenMetadata;
  userBalance?: bigint;
  userRoles?: TokenRole[];
}
