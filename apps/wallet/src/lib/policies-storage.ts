import type { Address } from 'viem';
import { db, type Policy } from './db';

export type { Policy };

export async function savePolicy(policy: Omit<Policy, 'id' | 'createdAt'>): Promise<Policy> {
  const normalizedOwner = policy.owner.toLowerCase() as Address;
  const normalizedAdmin = policy.admin.toLowerCase() as Address;

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
  const normalizedOwner = owner.toLowerCase() as Address;
  const policies = await db.policies.where('owner').equals(normalizedOwner).toArray();

  // Sort by createdAt descending (newest first)
  return policies.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPolicyByPolicyId(
  policyId: string,
  owner: Address
): Promise<Policy | null> {
  const normalizedOwner = owner.toLowerCase() as Address;
  const policy = await db.policies
    .where('[owner+policyId]')
    .equals([normalizedOwner, policyId])
    .first();

  return policy ?? null;
}

export async function deletePolicy(id: string, owner: Address): Promise<void> {
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
  const existing = await db.policies.get(id);
  if (!existing) {
    throw new Error('Policy not found');
  }
  if (existing.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to update this policy');
  }
  await db.policies.update(id, { admin: newAdmin.toLowerCase() as Address });
}
