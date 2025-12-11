import Dexie, { type EntityTable } from 'dexie';
import type { Address } from 'viem';

/**
 * Stablecoin entity
 */
export interface Stablecoin {
  id: string;
  address: Address;
  name: string;
  symbol: string;
  currency: string;
  creator: Address;
  txHash: string;
  createdAt: number;
}

/**
 * Contact entity
 */
export interface Contact {
  id: string;
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
 * Tollr Database - unified IndexedDB database for all app data
 */
const db = new Dexie('tollr') as Dexie & {
  stablecoins: EntityTable<Stablecoin, 'id'>;
  contacts: EntityTable<Contact, 'id'>;
  scheduledTransactions: EntityTable<ScheduledTransaction, 'id'>;
};

// Define schema with indexes
db.version(1).stores({
  stablecoins: 'id, creator, &address',
  contacts: 'id, address, name',
  scheduledTransactions: 'id, from, status, [from+status]',
});

export { db };
