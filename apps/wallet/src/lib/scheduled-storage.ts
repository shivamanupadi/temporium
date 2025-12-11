import type { Address } from 'viem';
import { db, type ScheduledTransaction } from './db';

export type { ScheduledTransaction };

/**
 * Save a new scheduled transaction
 */
export async function saveScheduledTransaction(
  tx: Omit<ScheduledTransaction, 'id' | 'createdAt' | 'status'>
): Promise<ScheduledTransaction> {
  const scheduledTx: ScheduledTransaction = {
    ...tx,
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
 * Get all scheduled transactions for a specific address
 */
export async function getScheduledTransactions(
  fromAddress: Address
): Promise<ScheduledTransaction[]> {
  const transactions = await db.scheduledTransactions
    .where('from')
    .equals(fromAddress.toLowerCase())
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
  status: 'pending' | 'executed' | 'failed',
  executedAt?: number
): Promise<void> {
  const tx = await db.scheduledTransactions.get(id);
  if (!tx) {
    throw new Error('Transaction not found');
  }

  await db.scheduledTransactions.update(id, {
    status,
    ...(executedAt !== undefined && { executedAt }),
  });
}

/**
 * Delete a scheduled transaction
 */
export async function deleteScheduledTransaction(id: string): Promise<void> {
  await db.scheduledTransactions.delete(id);
}

/**
 * Get pending transactions that should have executed (past scheduledFor time)
 */
export async function getPendingTransactionsPastSchedule(
  fromAddress: Address
): Promise<ScheduledTransaction[]> {
  const transactions = await getScheduledTransactions(fromAddress);
  const now = Math.floor(Date.now() / 1000);

  return transactions.filter(tx => tx.status === 'pending' && tx.scheduledFor <= now);
}

/**
 * Clear all scheduled transactions (for testing/debugging)
 */
export async function clearAllScheduledTransactions(): Promise<void> {
  await db.scheduledTransactions.clear();
}
