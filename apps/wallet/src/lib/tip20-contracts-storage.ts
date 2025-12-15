import type { Address } from 'viem';
import { apiGet, apiPost, apiDelete } from './api-client';

export interface Tip20Contract {
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

interface Tip20ContractApiResponse {
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

function apiToTip20Contract(data: Tip20ContractApiResponse): Tip20Contract {
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

export async function saveTip20Contract(
  contract: Omit<Tip20Contract, 'id' | 'createdAt' | 'owner'> & { owner?: Address }
): Promise<Tip20Contract> {
  const normalizedAddress = contract.address.toLowerCase() as Address;
  const normalizedCreator = contract.creator.toLowerCase() as Address;

  const response = await apiPost<Tip20ContractApiResponse>('/v1/tip20-contracts', {
    address: normalizedAddress,
    name: contract.name,
    symbol: contract.symbol,
    currency: contract.currency,
    creator: normalizedCreator,
    txHash: contract.txHash,
  });
  return apiToTip20Contract(response);
}

export async function getTip20ContractsByOwner(_owner: Address): Promise<Tip20Contract[]> {
  const response = await apiGet<Tip20ContractApiResponse[]>('/v1/tip20-contracts');
  return response.map(apiToTip20Contract).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTip20ContractByAddress(address: Address): Promise<Tip20Contract | null> {
  const normalizedAddress = address.toLowerCase() as Address;

  try {
    const contracts = await apiGet<Tip20ContractApiResponse[]>('/v1/tip20-contracts');
    const found = contracts.find(c => c.address.toLowerCase() === normalizedAddress);
    return found ? apiToTip20Contract(found) : null;
  } catch {
    return null;
  }
}

export async function deleteTip20Contract(id: string, _owner: Address): Promise<void> {
  await apiDelete(`/v1/tip20-contracts/${id}`);
}

// Legacy aliases for backwards compatibility during migration
export type Stablecoin = Tip20Contract;
export const saveStablecoin = saveTip20Contract;
export const getStablecoinsByOwner = getTip20ContractsByOwner;
export const getStablecoinByAddress = getTip20ContractByAddress;
export const deleteStablecoin = deleteTip20Contract;
