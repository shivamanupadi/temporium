import type { Address } from 'viem';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { hasAuthTokens } from './auth-storage';
import { db, type ScheduledTransaction } from './db';

export type { ScheduledTransaction };

/**
 * API response types
 */
interface ScheduledTransactionApiResponse {
  id: string;
  owner: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  feeToken: string;
  memo?: string;
  scheduledFor: string;
  createdAt: string;
  status: 'pending' | 'executed' | 'failed';
  executedAt?: string;
}

/**
 * Convert API response to ScheduledTransaction type
 */
function apiToScheduledTransaction(data: ScheduledTransactionApiResponse): ScheduledTransaction {
  return {
    id: data.id,
    owner: data.owner as Address,
    txHash: data.txHash,
    from: data.from as Address,
    to: data.to as Address,
    amount: data.amount,
    token: data.token as Address,
    tokenSymbol: data.tokenSymbol,
    tokenDecimals: data.tokenDecimals,
    feeToken: data.feeToken as Address,
    memo: data.memo,
    scheduledFor: Math.floor(new Date(data.scheduledFor).getTime() / 1000),
    createdAt: Math.floor(new Date(data.createdAt).getTime() / 1000),
    status: data.status,
    executedAt: data.executedAt
      ? Math.floor(new Date(data.executedAt).getTime() / 1000)
      : undefined,
  };
}

/**
 * Check if API is available (user is authenticated)
 */
function useApi(): boolean {
  return hasAuthTokens();
}

/**
 * Save a new scheduled transaction
 */
export async function saveScheduledTransaction(
  tx: Omit<ScheduledTransaction, 'id' | 'createdAt' | 'status'>
): Promise<ScheduledTransaction> {
  const normalizedOwner = tx.owner.toLowerCase() as Address;

  // Use API if authenticated
  if (useApi()) {
    const response = await apiPost<ScheduledTransactionApiResponse>(
      '/api/scheduled-transactions',
      {
        txHash: tx.txHash,
        from: tx.from.toLowerCase(),
        to: tx.to.toLowerCase(),
        amount: tx.amount,
        token: tx.token.toLowerCase(),
        tokenSymbol: tx.tokenSymbol,
        tokenDecimals: tx.tokenDecimals,
        feeToken: tx.feeToken.toLowerCase(),
        memo: tx.memo,
        scheduledFor: new Date(tx.scheduledFor * 1000).toISOString(),
      }
    );
    return apiToScheduledTransaction(response);
  }

  // Fallback to IndexedDB
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
  // Use API if authenticated
  if (useApi()) {
    const response = await apiGet<ScheduledTransactionApiResponse[]>(
      '/api/scheduled-transactions'
    );
    return response.map(apiToScheduledTransaction).sort((a, b) => b.scheduledFor - a.scheduledFor);
  }

  // Fallback to IndexedDB
  const normalizedOwner = owner.toLowerCase();
  const transactions = await db.scheduledTransactions
    .where('owner')
    .equals(normalizedOwner)
    .toArray();

  return transactions.sort((a, b) => b.scheduledFor - a.scheduledFor);
}

/**
 * Get a single scheduled transaction by ID
 */
export async function getScheduledTransaction(id: string): Promise<ScheduledTransaction | null> {
  // Use API if authenticated
  if (useApi()) {
    try {
      const response = await apiGet<ScheduledTransactionApiResponse>(
        `/api/scheduled-transactions/${id}`
      );
      return apiToScheduledTransaction(response);
    } catch {
      return null;
    }
  }

  // Fallback to IndexedDB
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
  // Use API if authenticated
  if (useApi()) {
    await apiPatch(`/api/scheduled-transactions/${id}`, {
      status,
      executedAt: executedAt ? new Date(executedAt * 1000).toISOString() : undefined,
    });
    return;
  }

  // Fallback to IndexedDB
  const tx = await db.scheduledTransactions.get(id);
  if (!tx) {
    throw new Error('Transaction not found');
  }

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
  // Use API if authenticated
  if (useApi()) {
    await apiDelete(`/api/scheduled-transactions/${id}`);
    return;
  }

  // Fallback to IndexedDB
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
  // Only for IndexedDB - not available via API
  if (!useApi()) {
    const normalizedOwner = owner.toLowerCase();
    await db.scheduledTransactions.where('owner').equals(normalizedOwner).delete();
  }
}
