import type { Address } from 'viem';
import { db, type ScheduledTransaction } from './db';

export type { ScheduledTransaction };

/**
 * Save a new scheduled transaction
 */
export async function saveScheduledTransaction(
  tx: Omit<ScheduledTransaction, 'id' | 'createdAt' | 'status'>
): Promise<ScheduledTransaction> {
  const normalizedOwner = tx.owner.toLowerCase() as Address;

  const scheduledTx: ScheduledTransaction = {
    ...tx,
    owner: normalizedOwner,
    from: tx.from.toLowerCase() as Address,
    to: tx.to.toLowerCase() as Address,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Math.floor(Date.now() / 1000),
    status: 'pending',
  };

  await db.scheduledTransactions.add(scheduledTx);
  return scheduledTx;
}

/**
 * Get all scheduled transactions for a specific owner
 */
export async function getScheduledTransactionsByOwner(
  owner: Address
): Promise<ScheduledTransaction[]> {
  const normalizedOwner = owner.toLowerCase();
  const transactions = await db.scheduledTransactions
    .where('owner')
    .equals(normalizedOwner)
    .toArray();

  // Sort by scheduledFor descending (newest first)
  return transactions.sort((a, b) => b.scheduledFor - a.scheduledFor);
}

/**
 * Get a single scheduled transaction by ID
 */
export async function getScheduledTransaction(id: string): Promise<ScheduledTransaction | null> {
  const tx = await db.scheduledTransactions.get(id);
  return tx ?? null;
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  id: string,
  owner: Address,
  status: 'pending' | 'executed' | 'failed',
  executedAt?: number
): Promise<void> {
  const tx = await db.scheduledTransactions.get(id);
  if (!tx) {
    throw new Error('Transaction not found');
  }

  // Verify ownership
  if (tx.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to update this transaction');
  }

  await db.scheduledTransactions.update(id, {
    status,
    ...(executedAt !== undefined && { executedAt }),
  });
}

/**
 * Delete a scheduled transaction
 */
export async function deleteScheduledTransaction(id: string, owner: Address): Promise<void> {
  const tx = await db.scheduledTransactions.get(id);
  if (tx && tx.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this transaction');
  }
  await db.scheduledTransactions.delete(id);
}

/**
 * Get pending transactions that should have executed (past scheduledFor time)
 */
export async function getPendingTransactionsPastSchedule(
  owner: Address
): Promise<ScheduledTransaction[]> {
  const transactions = await getScheduledTransactionsByOwner(owner);
  const now = Math.floor(Date.now() / 1000);

  return transactions.filter(tx => tx.status === 'pending' && tx.scheduledFor <= now);
}

/**
 * Clear all scheduled transactions for an owner (for testing/debugging)
 */
export async function clearAllScheduledTransactions(owner: Address): Promise<void> {
  const normalizedOwner = owner.toLowerCase();
  await db.scheduledTransactions.where('owner').equals(normalizedOwner).delete();
}
