import Dexie, { type EntityTable } from 'dexie';
import type { Address } from 'viem';

/**
 * Stablecoin entity
 */
export interface Stablecoin {
  id: string;
  owner: Address; // The wallet address that owns this record
  address: Address;
  name: string;
  symbol: string;
  currency: string;
  creator: Address; // Keep for backwards compatibility, same as owner
  txHash: string;
  createdAt: number;
}

/**
 * Contact entity
 */
export interface Contact {
  id: string;
  owner: Address; // The wallet address that owns this contact
  name: string;
  address: Address;
  createdAt: number;
  updatedAt: number;
}

/**
 * Scheduled Transaction entity
 */
export interface ScheduledTransaction {
  id: string;
  owner: Address; // The wallet address that owns this record
  txHash: string;
  from: Address;
  to: Address;
  amount: string;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  feeToken: Address;
  memo?: string;
  scheduledFor: number;
  createdAt: number;
  status: 'pending' | 'executed' | 'failed';
  executedAt?: number;
}

/**
 * TIP-403 Policy entity
 */
export interface Policy {
  id: string;
  owner: Address; // The wallet address that owns this record
  policyId: string; // On-chain policy ID (stored as string for IndexedDB compatibility)
  type: 'whitelist' | 'blacklist';
  admin: Address; // Policy admin address at time of import/creation
  txHash?: string; // Creation tx hash (if created locally)
  createdAt: number;
}

/**
 * Tollr Database - unified IndexedDB database for all app data
 */
const db = new Dexie('tollr') as Dexie & {
  stablecoins: EntityTable<Stablecoin, 'id'>;
  contacts: EntityTable<Contact, 'id'>;
  scheduledTransactions: EntityTable<ScheduledTransaction, 'id'>;
  policies: EntityTable<Policy, 'id'>;
};

// Define schema with indexes
db.version(1).stores({
  stablecoins: 'id, creator, &address',
  contacts: 'id, address, name',
  scheduledTransactions: 'id, from, status, [from+status]',
});

// Version 2: Add owner field to contacts for multi-address support
db.version(2).stores({
  stablecoins: 'id, creator, &address',
  contacts: 'id, owner, address, name, [owner+address]',
  scheduledTransactions: 'id, from, status, [from+status]',
});

// Version 3: Add owner field to all tables for consistent multi-address support
db.version(3).stores({
  stablecoins: 'id, owner, &address, creator',
  contacts: 'id, owner, address, name, [owner+address]',
  scheduledTransactions: 'id, owner, from, to, status, [owner+status]',
});

// Version 4: Add policies table for TIP-403 policy management
db.version(4).stores({
  stablecoins: 'id, owner, &address, creator',
  contacts: 'id, owner, address, name, [owner+address]',
  scheduledTransactions: 'id, owner, from, to, status, [owner+status]',
  policies: 'id, owner, policyId, type, [owner+policyId]',
});

export { db };
