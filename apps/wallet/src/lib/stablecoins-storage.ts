import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';
import { hasAuthTokens } from './auth-storage';
import { db, type Stablecoin } from './db';

export type { Stablecoin };

/**
 * API response types
 */
interface StablecoinApiResponse {
  id: string;
  owner: string;
  address: string;
  name: string;
  symbol: string;
  currency: string;
  creator: string;
  txHash: string;
  createdAt: string;
}

/**
 * Convert API response to Stablecoin type
 */
function apiToStablecoin(data: StablecoinApiResponse): Stablecoin {
  return {
    id: data.id,
    owner: data.owner as Address,
    address: data.address as Address,
    name: data.name,
    symbol: data.symbol,
    currency: data.currency,
    creator: data.creator as Address,
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

export async function saveStablecoin(
  stablecoin: Omit<Stablecoin, 'id' | 'createdAt' | 'owner'> & { owner?: Address }
): Promise<Stablecoin> {
  const normalizedAddress = stablecoin.address.toLowerCase() as Address;
  const normalizedCreator = stablecoin.creator.toLowerCase() as Address;
  const normalizedOwner = (stablecoin.owner ?? stablecoin.creator).toLowerCase() as Address;

  // Use API if authenticated
  if (useApi()) {
    const response = await apiPost<StablecoinApiResponse>('/api/stablecoins', {
      address: normalizedAddress,
      name: stablecoin.name,
      symbol: stablecoin.symbol,
      currency: stablecoin.currency,
      creator: normalizedCreator,
      txHash: stablecoin.txHash,
    });
    return apiToStablecoin(response);
  }

  // Fallback to IndexedDB
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
  // Use API if authenticated
  if (useApi()) {
    const response = await apiGet<StablecoinApiResponse[]>('/api/stablecoins');
    return response.map(apiToStablecoin).sort((a, b) => b.createdAt - a.createdAt);
  }

  // Fallback to IndexedDB
  const normalizedOwner = owner.toLowerCase() as Address;
  const stablecoins = await db.stablecoins.where('owner').equals(normalizedOwner).toArray();
  return stablecoins.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStablecoinByAddress(address: Address): Promise<Stablecoin | null> {
  const normalizedAddress = address.toLowerCase() as Address;

  // Use API if authenticated - search in user's stablecoins
  if (useApi()) {
    try {
      const stablecoins = await apiGet<StablecoinApiResponse[]>('/api/stablecoins');
      const found = stablecoins.find(s => s.address.toLowerCase() === normalizedAddress);
      return found ? apiToStablecoin(found) : null;
    } catch {
      return null;
    }
  }

  // Fallback to IndexedDB
  const stablecoin = await db.stablecoins.where('address').equals(normalizedAddress).first();
  return stablecoin ?? null;
}

export async function deleteStablecoin(id: string, owner: Address): Promise<void> {
  // Use API if authenticated
  if (useApi()) {
    await apiDelete(`/api/stablecoins/${id}`);
    return;
  }

  // Fallback to IndexedDB
  const existing = await db.stablecoins.get(id);
  if (existing && existing.owner?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this stablecoin');
  }
  await db.stablecoins.delete(id);
}
