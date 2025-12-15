import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  getScheduledTransactionsByOwner,
  updateTransactionStatus,
  type ScheduledTransaction,
} from '@/lib/scheduled-storage';
import { tempoPublicClient } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

/**
 * Hook to manage and display scheduled transactions
 * - Loads transactions from IndexedDB
 * - Checks on-chain status for pending transactions past their scheduled time
 * - Updates status when confirmed on-chain
 */
interface UseScheduledTransactionsReturn {
  transactions: ScheduledTransaction[];
  pendingTransactions: ScheduledTransaction[];
  completedTransactions: ScheduledTransaction[];
  isLoading: boolean;
  isChecking: boolean;
  refresh: () => Promise<void>;
}

export function useScheduledTransactions(): UseScheduledTransactionsReturn {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // Load transactions from IndexedDB
  const loadTransactions = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      const txns = await getScheduledTransactionsByOwner(address);
      setTransactions(txns);
    } catch (error) {
      console.error('Failed to load scheduled transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Check on-chain status for a single transaction
  const checkTransactionStatus = useCallback(
    async (tx: ScheduledTransaction): Promise<boolean> => {
      if (!address) return false;

      try {
        const receipt = await tempoPublicClient.getTransactionReceipt({
          hash: tx.txHash as `0x${string}`,
        });

        if (receipt) {
          // Transaction has been executed
          const executedAt = Math.floor(Date.now() / 1000);
          const status = receipt.status === 'success' ? 'executed' : 'failed';

          await updateTransactionStatus(tx.id, address, status, executedAt);
          return true; // Status changed
        }
      } catch (error) {
        // Transaction not found or not yet executed - this is expected for pending transactions
        console.debug(`Transaction ${tx.txHash} not yet executed`);
      }
      return false; // Status unchanged
    },
    [address]
  );

  // Check status for all pending transactions past their scheduled time
  const checkPendingStatuses = useCallback(async () => {
    if (!address || isChecking) return;

    const now = Math.floor(Date.now() / 1000);
    const pendingPastSchedule = transactions.filter(
      tx => tx.status === 'pending' && tx.scheduledFor <= now
    );

    if (pendingPastSchedule.length === 0) return;

    setIsChecking(true);
    let hasChanges = false;

    try {
      for (const tx of pendingPastSchedule) {
        const changed = await checkTransactionStatus(tx);
        if (changed) hasChanges = true;
      }

      // Reload if any status changed
      if (hasChanges) {
        await loadTransactions();
      }
    } finally {
      setIsChecking(false);
    }
  }, [address, transactions, isChecking, checkTransactionStatus, loadTransactions]);

  // Initial load
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Poll for status updates periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkPendingStatuses();
    }, TIMING.SCHEDULED_TX_CHECK_MS);

    // Also check immediately when transactions change
    checkPendingStatuses();

    return () => clearInterval(interval);
  }, [checkPendingStatuses]);

  // Separate pending and completed transactions
  const pendingTransactions = transactions.filter(tx => tx.status === 'pending');
  const completedTransactions = transactions.filter(
    tx => tx.status === 'executed' || tx.status === 'failed'
  );

  // Force refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadTransactions();
    await checkPendingStatuses();
  }, [loadTransactions, checkPendingStatuses]);

  return {
    transactions,
    pendingTransactions,
    completedTransactions,
    isLoading,
    isChecking,
    refresh,
  };
}
