import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';

export interface Stablecoin {
  id: string;
  owner: Address;
  address: Address;
  name: string;
  symbol: string;
  currency: string;
  creator: Address;
  txHash: string;
  createdAt: number;
}

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

export async function saveStablecoin(
  stablecoin: Omit<Stablecoin, 'id' | 'createdAt' | 'owner'> & { owner?: Address }
): Promise<Stablecoin> {
  const normalizedAddress = stablecoin.address.toLowerCase() as Address;
  const normalizedCreator = stablecoin.creator.toLowerCase() as Address;

  const response = await apiPost<StablecoinApiResponse>('/v1/stablecoins', {
    address: normalizedAddress,
    name: stablecoin.name,
    symbol: stablecoin.symbol,
    currency: stablecoin.currency,
    creator: normalizedCreator,
    txHash: stablecoin.txHash,
  });
  return apiToStablecoin(response);
}

export async function getStablecoinsByOwner(_owner: Address): Promise<Stablecoin[]> {
  const response = await apiGet<StablecoinApiResponse[]>('/v1/stablecoins');
  return response.map(apiToStablecoin).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStablecoinByAddress(address: Address): Promise<Stablecoin | null> {
  const normalizedAddress = address.toLowerCase() as Address;

  try {
    const stablecoins = await apiGet<StablecoinApiResponse[]>('/v1/stablecoins');
    const found = stablecoins.find(s => s.address.toLowerCase() === normalizedAddress);
    return found ? apiToStablecoin(found) : null;
  } catch {
    return null;
  }
}

export async function deleteStablecoin(id: string, _owner: Address): Promise<void> {
  await apiDelete(`/v1/stablecoins/${id}`);
}
