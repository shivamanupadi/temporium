import { apiDelete, apiGet, apiPost } from './api-client';
import type { Address, Hex } from 'viem';

export type VirtualMasterStatus = 'pending' | 'registered';

export interface VirtualMaster {
  id: string;
  owner: Address;
  masterId: Hex;
  salt: Hex | null;
  txHash: Hex | null;
  status: VirtualMasterStatus;
  discoveredFrom: 'portal' | 'onchain';
  network: 'testnet' | 'mainnet';
  registeredAt: string | null;
}

export interface VirtualAddress {
  id: string;
  owner: Address;
  masterId: Hex;
  userTag: Hex;
  address: Address;
  label: string;
  createdAt: string | null;
}

export interface CreateVirtualAddressBody {
  label: string;
}

export interface ImportVirtualAddressBody {
  address: Address;
  label: string;
}

export interface RegisterMasterBody {
  masterId: Hex;
  salt: Hex;
  txHash: Hex;
  network: 'testnet' | 'mainnet';
}

export interface LookupMasterBody {
  masterId: Hex;
}

const BASE = '/v1/virtual-addresses';

export function getVirtualMaster(): Promise<VirtualMaster> {
  return apiGet<VirtualMaster>(`${BASE}/master`);
}

export function registerVirtualMaster(body: RegisterMasterBody): Promise<VirtualMaster> {
  return apiPost<VirtualMaster>(`${BASE}/master`, body);
}

export function lookupVirtualMaster(body: LookupMasterBody): Promise<VirtualMaster> {
  return apiPost<VirtualMaster>(`${BASE}/master/lookup`, body);
}

/**
 * Recover the caller's master ID by scanning the last ~10 days of
 * `MasterRegistered` events. Server walks history in 100k-block chunks
 * (Tempo RPC's max range). Throws ApiClientError(404) when nothing is
 * found in the window.
 */
export function recoverVirtualMaster(): Promise<VirtualMaster> {
  return apiPost<VirtualMaster>(`${BASE}/master/recover`, {});
}

export interface MinedSalt {
  salt: Hex;
  masterId: Hex;
  elapsedMs: number;
  /** True when the salt was returned from a previously persisted pending row,
   *  not freshly mined. */
  resumed: boolean;
}

/**
 * Server-side TIP-1022 PoW grinding via the MineSaltContainer.
 * The browser MUST re-validate the returned salt with VirtualMaster.validateSalt
 * before broadcasting the registration tx — the API does too, but defense-in-depth.
 */
export function mineSaltViaApi(): Promise<MinedSalt> {
  return apiPost<MinedSalt>(`${BASE}/master/mine-salt`, {});
}

export function listVirtualAddresses(): Promise<VirtualAddress[]> {
  return apiGet<VirtualAddress[]>(BASE);
}

export function getVirtualAddress(id: string): Promise<VirtualAddress> {
  return apiGet<VirtualAddress>(`${BASE}/${id}`);
}

export function createVirtualAddress(body: CreateVirtualAddressBody): Promise<VirtualAddress> {
  return apiPost<VirtualAddress>(BASE, body);
}

export function importVirtualAddress(body: ImportVirtualAddressBody): Promise<VirtualAddress> {
  return apiPost<VirtualAddress>(`${BASE}/import`, body);
}

export function deleteVirtualAddress(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`);
}
