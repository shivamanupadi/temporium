import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Address, Hex } from 'viem';

export type RecurringStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type RecurringExecutionStatus = 'success' | 'skipped' | 'failed';

export interface RecurringTransaction {
  id: string;
  owner: string;
  accessKeyDbId: string;
  accessKeyId: string;
  accessKeySignatureType: 'secp256k1' | 'p256';
  network: string;
  to: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  feeToken: string;
  memo: string | null;
  intervalSeconds: number;
  startAt: string;
  endAt: string | null;
  maxExecutions: number | null;
  status: RecurringStatus;
  executionsCompleted: number;
  consecutiveFailures: number;
  nextRunAt: string;
  lastRunAt: string | null;
  lastTxHash: string | null;
  lastFailReason: string | null;
  label: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface RecurringExecution {
  id: string;
  recurringId: string;
  runNumber: number;
  status: RecurringExecutionStatus;
  txHash: string | null;
  failReason: string | null;
  executedAt: string;
}

export interface CreateRecurringInput {
  accessKeyDbId: string;
  accessKeyId: Address;
  accessKeySignatureType: 'secp256k1' | 'p256';
  accessKeyPrivateKey: Hex;
  to: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  feeToken: Address;
  memo?: string;
  intervalSeconds: number;
  startAt: string; // ISO
  endAt?: string;
  maxExecutions?: number;
  label?: string;
  notes?: string;
}

export const RECURRING_QUERY_KEY = 'recurringTransactions';

interface UseRecurringTransactionsReturn {
  items: RecurringTransaction[];
  isLoading: boolean;
  create: (input: CreateRecurringInput) => Promise<RecurringTransaction>;
  creating: boolean;
  pause: (id: string) => Promise<RecurringTransaction>;
  resume: (id: string) => Promise<RecurringTransaction>;
  cancel: (id: string) => Promise<void>;
  updateMetadata: (params: {
    id: string;
    label?: string;
    notes?: string;
  }) => Promise<RecurringTransaction>;
  fetchExecutions: (id: string) => Promise<RecurringExecution[]>;
}

export function useRecurringTransactions(): UseRecurringTransactionsReturn {
  const { address } = useAccount();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: [RECURRING_QUERY_KEY, address],
    enabled: !!address,
    queryFn: async () => {
      const res = await apiGet<{ items: RecurringTransaction[]; nextCursor: string | null }>(
        '/v1/recurring-transactions?limit=50'
      );
      return res.items;
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateRecurringInput) => {
      return apiPost<RecurringTransaction>('/v1/recurring-transactions', input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] }),
  });

  const updateStatus = useMutation({
    mutationFn: async (params: { id: string; status: 'active' | 'paused' | 'cancelled' }) => {
      return apiPatch<RecurringTransaction>(`/v1/recurring-transactions/${params.id}`, {
        status: params.status,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] }),
  });

  const updateMetadata = useMutation({
    mutationFn: async (params: { id: string; label?: string; notes?: string }) => {
      const { id, ...body } = params;
      return apiPatch<RecurringTransaction>(`/v1/recurring-transactions/${id}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => apiDelete<void>(`/v1/recurring-transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] }),
  });

  const fetchExecutions = useCallback(async (id: string): Promise<RecurringExecution[]> => {
    return apiGet<RecurringExecution[]>(`/v1/recurring-transactions/${id}/executions`);
  }, []);

  return {
    items,
    isLoading,
    create: create.mutateAsync,
    creating: create.isPending,
    pause: (id: string) => updateStatus.mutateAsync({ id, status: 'paused' }),
    resume: (id: string) => updateStatus.mutateAsync({ id, status: 'active' }),
    cancel: cancel.mutateAsync,
    updateMetadata: updateMetadata.mutateAsync,
    fetchExecutions,
  };
}
