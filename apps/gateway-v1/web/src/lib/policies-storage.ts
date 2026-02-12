import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';
import type { Policy } from '@/types';

export async function savePolicy(policy: {
  owner: Address;
  policyId: string;
  type: 'whitelist' | 'blacklist';
  admin: Address;
  txHash?: string;
}): Promise<Policy> {
  const normalizedAdmin = policy.admin.toLowerCase() as Address;

  const response = await apiPost<Policy>('/v1/policies', {
    policyId: policy.policyId,
    type: policy.type,
    admin: normalizedAdmin,
    txHash: policy.txHash,
  });
  return response;
}

export async function getPoliciesByOwner(): Promise<Policy[]> {
  const response = await apiGet<Policy[]>('/v1/policies');
  return response.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getPolicyByPolicyId(
  policyId: string
): Promise<Policy | null> {
  const policies = await getPoliciesByOwner();
  return policies.find(p => p.policyId === policyId) ?? null;
}

export async function deletePolicy(id: string): Promise<void> {
  await apiDelete(`/v1/policies/${id}`);
}
