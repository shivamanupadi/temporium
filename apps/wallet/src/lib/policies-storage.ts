import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';

export interface Policy {
  id: string;
  owner: Address;
  policyId: string;
  type: 'whitelist' | 'blacklist';
  admin: Address;
  txHash?: string;
  createdAt: number;
}

interface PolicyApiResponse {
  id: string;
  owner: string;
  policyId: string;
  type: 'whitelist' | 'blacklist';
  admin: string;
  txHash?: string;
  createdAt: string;
}

function apiToPolicy(data: PolicyApiResponse): Policy {
  return {
    id: data.id,
    owner: data.owner as Address,
    policyId: data.policyId,
    type: data.type,
    admin: data.admin as Address,
    txHash: data.txHash,
    createdAt: new Date(data.createdAt).getTime(),
  };
}

export async function savePolicy(policy: Omit<Policy, 'id' | 'createdAt'>): Promise<Policy> {
  const normalizedAdmin = policy.admin.toLowerCase() as Address;

  const response = await apiPost<PolicyApiResponse>('/v1/policies', {
    policyId: policy.policyId,
    type: policy.type,
    admin: normalizedAdmin,
    txHash: policy.txHash,
  });
  return apiToPolicy(response);
}

export async function getPoliciesByOwner(_owner: Address): Promise<Policy[]> {
  const response = await apiGet<PolicyApiResponse[]>('/v1/policies');
  return response.map(apiToPolicy).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPolicyByPolicyId(
  policyId: string,
  owner: Address
): Promise<Policy | null> {
  const policies = await getPoliciesByOwner(owner);
  return policies.find(p => p.policyId === policyId) ?? null;
}

export async function deletePolicy(id: string, _owner: Address): Promise<void> {
  await apiDelete(`/v1/policies/${id}`);
}

export async function updatePolicyAdmin(
  _id: string,
  _owner: Address,
  _newAdmin: Address
): Promise<void> {
  // Policy admin updates are done on-chain, not via API
}
