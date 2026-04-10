import type { Address } from 'viem';

export * from './wallet-connect';

/**
 * Wallet connection type
 */
export type WalletType = 'passkey' | 'injected' | 'tempo' | null;

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
 * Recurring Payment
 */
export interface RecurringPayment {
  id: string;
  owner: string;
  recipient: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  intervalSeconds: number;
  maxPayments: number;
  paymentsMade: number;
  subscriptionId: number;
  contractAddress: Address;
  network: string;
  status: RecurringPaymentStatus;
  nextPaymentAt: string; // ISO datetime from Drizzle timestamp mode
  lastPaidAt?: string; // ISO datetime from Drizzle timestamp mode
  txHash?: string;
  label?: string;
  createdAt: string;
  failReason?: string;
}

export type RecurringPaymentStatus = 'active' | 'completed' | 'cancelled' | 'failed';

/**
 * Recurring Payment Execution (individual payment record)
 */
export interface RecurringPaymentExecution {
  id: string;
  recurringPaymentId: string;
  paymentNumber: number;
  txHash: string;
  amount: string;
  status: string;
  executedAt: string; // ISO datetime
  failReason?: string;
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

/**
 * Access Key types for AccountKeychain
 */
export type AccessKeyType = 'secp256k1' | 'p256' | 'webAuthn';

export interface TokenSpendingLimit {
  token: Address;
  limit: bigint;
  remaining?: bigint;
}

export interface AccessKey {
  keyId: Address;
  signatureType: AccessKeyType;
  expiry: number; // Unix timestamp (0 = never expires)
  enforceLimits: boolean;
  isRevoked: boolean;
}

export interface AccessKeyWithLimits extends AccessKey {
  limits: TokenSpendingLimit[];
}
