import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';
import { hasAuthTokens } from './auth-storage';
import { db, type Policy } from './db';

export type { Policy };

/**
 * API response types
 */
interface PolicyApiResponse {
  id: string;
  owner: string;
  policyId: string;
  type: 'whitelist' | 'blacklist';
  admin: string;
  txHash?: string;
  createdAt: string;
}

/**
 * Convert API response to Policy type
 */
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

/**
 * Check if API is available (user is authenticated)
 */
function useApi(): boolean {
  return hasAuthTokens();
}

export async function savePolicy(policy: Omit<Policy, 'id' | 'createdAt'>): Promise<Policy> {
  const normalizedOwner = policy.owner.toLowerCase() as Address;
  const normalizedAdmin = policy.admin.toLowerCase() as Address;

  // Use API if authenticated
  if (useApi()) {
    const response = await apiPost<PolicyApiResponse>('/api/policies', {
      policyId: policy.policyId,
      type: policy.type,
      admin: normalizedAdmin,
      txHash: policy.txHash,
    });
    return apiToPolicy(response);
  }

  // Fallback to IndexedDB
  const newPolicy: Policy = {
    ...policy,
    id: crypto.randomUUID(),
    owner: normalizedOwner,
    admin: normalizedAdmin,
    createdAt: Date.now(),
  };

  await db.policies.add(newPolicy);
  return newPolicy;
}

export async function getPoliciesByOwner(owner: Address): Promise<Policy[]> {
  // Use API if authenticated
  if (useApi()) {
    const response = await apiGet<PolicyApiResponse[]>('/api/policies');
    return response.map(apiToPolicy).sort((a, b) => b.createdAt - a.createdAt);
  }

  // Fallback to IndexedDB
  const normalizedOwner = owner.toLowerCase() as Address;
  const policies = await db.policies.where('owner').equals(normalizedOwner).toArray();
  return policies.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPolicyByPolicyId(
  policyId: string,
  owner: Address
): Promise<Policy | null> {
  // Use API if authenticated
  if (useApi()) {
    const policies = await getPoliciesByOwner(owner);
    return policies.find(p => p.policyId === policyId) ?? null;
  }

  // Fallback to IndexedDB
  const normalizedOwner = owner.toLowerCase() as Address;
  const policy = await db.policies
    .where('[owner+policyId]')
    .equals([normalizedOwner, policyId])
    .first();

  return policy ?? null;
}

export async function deletePolicy(id: string, owner: Address): Promise<void> {
  // Use API if authenticated
  if (useApi()) {
    await apiDelete(`/api/policies/${id}`);
    return;
  }

  // Fallback to IndexedDB
  const existing = await db.policies.get(id);
  if (existing && existing.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this policy');
  }
  await db.policies.delete(id);
}

export async function updatePolicyAdmin(
  id: string,
  owner: Address,
  newAdmin: Address
): Promise<void> {
  // API doesn't support updating policy admin directly
  // This is typically done on-chain

  // For IndexedDB fallback
  if (!useApi()) {
    const existing = await db.policies.get(id);
    if (!existing) {
      throw new Error('Policy not found');
    }
    if (existing.owner?.toLowerCase() !== owner.toLowerCase()) {
      throw new Error('Not authorized to update this policy');
    }
    await db.policies.update(id, { admin: newAdmin.toLowerCase() as Address });
  }
}
