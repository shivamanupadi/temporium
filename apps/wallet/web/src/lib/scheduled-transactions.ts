import { apiGet, apiDelete, publicApiRequest } from './api-client';
import { getAccessToken } from './auth-storage';
import { getWalletApiUrl, TEMPO_NETWORK } from './api';
import type { ScheduledTransaction } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface CreateScheduledTxParams {
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

export interface ScheduledTxConfig {
  /** Flat fee in token decimal units (e.g. "0.1"). "0" means no fee. */
  feeAmount: string;
  network: 'testnet' | 'mainnet';
}

// =============================================================================
// Public
// =============================================================================

/** Fetch the platform service-fee config (public, no auth). */
export function getScheduledTxConfig(): Promise<ScheduledTxConfig> {
  return publicApiRequest<ScheduledTxConfig>('/v1/scheduled-transactions/config');
}

// =============================================================================
// Authenticated
// =============================================================================

/**
 * Create a scheduled transaction via the mppx-gated endpoint.
 *
 * When a platform fee is active the server returns a 402 challenge on the first
 * call. `mppxFetch` (from `createMppxFetch()`) intercepts it, signs the fee
 * payment with the user's wallet, and retries — all transparently. The caller
 * just awaits the final result.
 *
 * Auth is handled manually (Bearer token + X-Tempo-Network) because we're
 * bypassing `apiPost` in favour of the scoped mppx fetch.
 */
export async function createScheduledTransaction(
  params: CreateScheduledTxParams,
  mppxFetch: typeof fetch
): Promise<ScheduledTransaction> {
  const url = `${getWalletApiUrl()}/v1/scheduled-transactions`;
  const accessToken = await getAccessToken();

  // Auth is passed via X-Tempo-Auth instead of Authorization because mppx
  // overwrites the Authorization header with its own payment credential on
  // the 402 retry. X-Tempo-Auth survives the retry untouched.
  const res = await mppxFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tempo-Network': TEMPO_NETWORK,
      ...(accessToken ? { 'X-Tempo-Auth': `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
      else if (typeof parsed?.error === 'string') message = parsed.error;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }

  const parsed = (await res.json()) as {
    success: boolean;
    data?: ScheduledTransaction;
    error?: string;
  };
  if (!parsed.success || !parsed.data) {
    throw new Error(parsed.error || 'Failed to create scheduled transaction');
  }
  return parsed.data;
}

// =============================================================================
// List / Detail / Delete (unchanged — standard auth, no mppx)
// =============================================================================

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
