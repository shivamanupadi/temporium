import { apiGet, apiPost, apiDelete } from './api-client';
import { getWalletApiUrl } from './api';
import { TEMPO_NETWORK } from './constants';
import type { RecurringPaymentExecution, RecurringPayment } from '@/types';

interface CreateRecurringPaymentParams {
  recipient: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  intervalSeconds: number;
  maxPayments?: number;
  subscriptionId: number;
  contractAddress: string;
  nextPaymentAt: string; // ISO datetime
  txHash?: string;
  label?: string;
}

export interface PaginatedRecurringPaymentResponse {
  items: RecurringPayment[];
  nextCursor: string | null;
}

interface ListRecurringPaymentParams {
  status?: string;
  network?: string;
  cursor?: string;
  limit?: number;
}

export function createRecurringPayment(
  params: CreateRecurringPaymentParams
): Promise<RecurringPayment> {
  return apiPost<RecurringPayment>('/v1/recurring-payments', params);
}

export function getRecurringPayments(
  params?: ListRecurringPaymentParams
): Promise<PaginatedRecurringPaymentResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.network) query.set('network', params.network);
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedRecurringPaymentResponse>(`/v1/recurring-payments${qs ? `?${qs}` : ''}`);
}

export function getRecurringPayment(id: string): Promise<RecurringPayment> {
  return apiGet<RecurringPayment>(`/v1/recurring-payments/${id}`);
}

export function getRecurringPaymentExecutions(id: string): Promise<RecurringPaymentExecution[]> {
  return apiGet<RecurringPaymentExecution[]>(`/v1/recurring-payments/${id}/executions`);
}

export function deleteRecurringPayment(id: string): Promise<void> {
  return apiDelete(`/v1/recurring-payments/${id}`);
}

let cachedContractAddress: `0x${string}` | null = null;

export async function getRecurringPaymentsContractAddress(): Promise<`0x${string}`> {
  if (cachedContractAddress) return cachedContractAddress;

  const res = await fetch(`${getWalletApiUrl()}/contracts`, {
    headers: { 'X-Tempo-Network': TEMPO_NETWORK },
  });
  const data = await res.json();
  if (data.success && data.data.contracts.recurringPayments?.address) {
    cachedContractAddress = data.data.contracts.recurringPayments.address as `0x${string}`;
    return cachedContractAddress;
  }
  throw new Error('Failed to load recurring payments contract address');
}
