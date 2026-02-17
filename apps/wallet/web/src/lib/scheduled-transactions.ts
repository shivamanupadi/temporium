import { apiGet, apiPost, apiDelete } from './api-client';
import type { ScheduledTransaction } from '@/types';

interface CreateScheduledTxParams {
  serializedTx: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  feeToken: string;
  memo?: string;
  scheduledFor: string; // ISO datetime
}

export interface PaginatedScheduledTxResponse {
  items: ScheduledTransaction[];
  nextCursor: string | null;
}

interface ListScheduledTxParams {
  status?: 'pending' | 'executed' | 'failed';
  cursor?: string;
  limit?: number;
}

export function createScheduledTransaction(
  params: CreateScheduledTxParams
): Promise<ScheduledTransaction> {
  return apiPost<ScheduledTransaction>('/v1/scheduled-transactions', params);
}

export function getScheduledTransactions(
  params?: ListScheduledTxParams
): Promise<PaginatedScheduledTxResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedScheduledTxResponse>(`/v1/scheduled-transactions${qs ? `?${qs}` : ''}`);
}

export function getScheduledTransaction(id: string): Promise<ScheduledTransaction> {
  return apiGet<ScheduledTransaction>(`/v1/scheduled-transactions/${id}`);
}

export function deleteScheduledTransaction(id: string): Promise<void> {
  return apiDelete(`/v1/scheduled-transactions/${id}`);
}
