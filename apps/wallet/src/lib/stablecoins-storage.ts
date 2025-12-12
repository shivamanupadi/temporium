import type { Address } from 'viem';
import { db, type Stablecoin } from './db';

export type { Stablecoin };

export async function saveStablecoin(
  stablecoin: Omit<Stablecoin, 'id' | 'createdAt' | 'owner'> & { owner?: Address }
): Promise<Stablecoin> {
  const normalizedAddress = stablecoin.address.toLowerCase() as Address;
  const normalizedCreator = stablecoin.creator.toLowerCase() as Address;
  // Use owner if provided, otherwise fall back to creator for backwards compatibility
  const normalizedOwner = (stablecoin.owner ?? stablecoin.creator).toLowerCase() as Address;

  // Check if this token is already in the user's list
  const existing = await db.stablecoins
    .where('[owner+address]')
    .equals([normalizedOwner, normalizedAddress])
    .first();

  if (existing) {
    throw new Error('This token is already in your list');
  }

  const newStablecoin: Stablecoin = {
    ...stablecoin,
    id: crypto.randomUUID(),
    owner: normalizedOwner,
    address: normalizedAddress,
    creator: normalizedCreator,
    createdAt: Date.now(),
  };

  await db.stablecoins.add(newStablecoin);
  return newStablecoin;
}

export async function getStablecoinsByOwner(owner: Address): Promise<Stablecoin[]> {
  const normalizedOwner = owner.toLowerCase() as Address;
  const stablecoins = await db.stablecoins.where('owner').equals(normalizedOwner).toArray();

  // Sort by createdAt descending
  return stablecoins.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStablecoinByAddress(address: Address): Promise<Stablecoin | null> {
  const normalizedAddress = address.toLowerCase() as Address;
  const stablecoin = await db.stablecoins.where('address').equals(normalizedAddress).first();

  return stablecoin ?? null;
}

export async function deleteStablecoin(id: string, owner: Address): Promise<void> {
  const existing = await db.stablecoins.get(id);
  if (existing && existing.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this stablecoin');
  }
  await db.stablecoins.delete(id);
}
