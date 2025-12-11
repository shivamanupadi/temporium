import type { Address } from 'viem';
import { db, type Stablecoin } from './db';

export type { Stablecoin };

export async function saveStablecoin(
  stablecoin: Omit<Stablecoin, 'id' | 'createdAt'>
): Promise<Stablecoin> {
  const newStablecoin: Stablecoin = {
    ...stablecoin,
    address: stablecoin.address.toLowerCase() as Address,
    creator: stablecoin.creator.toLowerCase() as Address,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  await db.stablecoins.add(newStablecoin);
  return newStablecoin;
}

export async function getStablecoinsByCreator(creator: Address): Promise<Stablecoin[]> {
  const normalizedCreator = creator.toLowerCase() as Address;
  const stablecoins = await db.stablecoins.where('creator').equals(normalizedCreator).toArray();

  // Sort by createdAt descending
  return stablecoins.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStablecoinByAddress(address: Address): Promise<Stablecoin | null> {
  const normalizedAddress = address.toLowerCase() as Address;
  const stablecoin = await db.stablecoins.where('address').equals(normalizedAddress).first();

  return stablecoin ?? null;
}

export async function deleteStablecoin(id: string): Promise<void> {
  await db.stablecoins.delete(id);
}
