/**
 * IndexedDB storage for deployed contracts using Dexie.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Address, Abi, Hash } from 'viem';

export interface DeployedContract {
  address: Address;
  name: string;
  abi: Abi;
  bytecode: `0x${string}`;
  deployedAt: Date;
  txHash: Hash;
  projectId?: string;
  sourcePath?: string; // e.g., "contracts/Token.sol"
}

// Define the database
const db = new Dexie('PlaygroundContractsDB') as Dexie & {
  contracts: EntityTable<DeployedContract, 'address'>;
};

// Define schema
db.version(1).stores({
  contracts: 'address, name, deployedAt, projectId',
});

/**
 * Save a deployed contract
 */
export async function saveDeployedContract(contract: DeployedContract): Promise<void> {
  await db.contracts.put(contract);
}

/**
 * Get all deployed contracts
 */
export async function getDeployedContracts(): Promise<DeployedContract[]> {
  return db.contracts.orderBy('deployedAt').reverse().toArray();
}

/**
 * Get a deployed contract by address
 */
export async function getDeployedContract(address: Address): Promise<DeployedContract | undefined> {
  return db.contracts.get(address);
}

/**
 * Delete a deployed contract
 */
export async function deleteDeployedContract(address: Address): Promise<void> {
  await db.contracts.delete(address);
}

/**
 * Get contracts by project ID
 */
export async function getContractsByProject(projectId: string): Promise<DeployedContract[]> {
  return db.contracts.where('projectId').equals(projectId).toArray();
}

/**
 * Update contract name
 */
export async function renameContract(address: Address, newName: string): Promise<void> {
  await db.contracts.update(address, { name: newName });
}
