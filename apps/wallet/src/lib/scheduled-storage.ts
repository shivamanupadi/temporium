import type { Address } from 'viem';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';

export interface ScheduledTransaction {
  id: string;
  owner: Address;
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

export async function saveScheduledTransaction(
  tx: Omit<ScheduledTransaction, 'id' | 'createdAt' | 'status'>
): Promise<ScheduledTransaction> {
  const response = await apiPost<ScheduledTransactionApiResponse>(
    '/v1/scheduled-transactions',
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

export async function getScheduledTransactionsByOwner(
  _owner: Address
): Promise<ScheduledTransaction[]> {
  const response = await apiGet<ScheduledTransactionApiResponse[]>(
    '/v1/scheduled-transactions'
  );
  return response.map(apiToScheduledTransaction).sort((a, b) => b.scheduledFor - a.scheduledFor);
}

export async function getScheduledTransaction(id: string): Promise<ScheduledTransaction | null> {
  try {
    const response = await apiGet<ScheduledTransactionApiResponse>(
      `/v1/scheduled-transactions/${id}`
    );
    return apiToScheduledTransaction(response);
  } catch {
    return null;
  }
}

export async function updateTransactionStatus(
  id: string,
  _owner: Address,
  status: 'pending' | 'executed' | 'failed',
  executedAt?: number
): Promise<void> {
  await apiPatch(`/v1/scheduled-transactions/${id}`, {
    status,
    executedAt: executedAt ? new Date(executedAt * 1000).toISOString() : undefined,
  });
}

export async function deleteScheduledTransaction(id: string, _owner: Address): Promise<void> {
  await apiDelete(`/v1/scheduled-transactions/${id}`);
}

export async function getPendingTransactionsPastSchedule(
  owner: Address
): Promise<ScheduledTransaction[]> {
  const transactions = await getScheduledTransactionsByOwner(owner);
  const now = Math.floor(Date.now() / 1000);

  return transactions.filter(tx => tx.status === 'pending' && tx.scheduledFor <= now);
}
