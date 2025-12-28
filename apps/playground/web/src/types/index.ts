import type { Abi } from 'viem';

/**
 * Project file
 */
export interface ProjectFile {
  name: string;
  content: string;
}

/**
 * Project stored in IndexedDB
 */
export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compilation error from solc
 */
export interface CompileError {
  severity: 'error' | 'warning';
  message: string;
  formattedMessage: string;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

/**
 * Compiled contract output
 */
export interface CompiledContract {
  name: string;
  abi: Abi;
  bytecode: `0x${string}`;
}

/**
 * Compilation result
 */
export interface CompileResult {
  success: boolean;
  contracts: CompiledContract[];
  errors: CompileError[];
  warnings: CompileError[];
}

/**
 * Deployed contract stored in IndexedDB
 */
export interface DeployedContract {
  address: `0x${string}`;
  name: string;
  abi: Abi;
  bytecode: `0x${string}`;
  deployedAt: Date;
  txHash: `0x${string}`;
  constructorArgs?: unknown[];
}

/**
 * Contract template
 */
export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'token' | 'defi' | 'utility';
  files: ProjectFile[];
}

/**
 * ABI function item for interaction
 */
export interface AbiFunction {
  type: 'function';
  name: string;
  inputs: AbiInput[];
  outputs: AbiOutput[];
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}

export interface AbiInput {
  name: string;
  type: string;
  internalType?: string;
  components?: AbiInput[];
}

export interface AbiOutput {
  name: string;
  type: string;
  internalType?: string;
  components?: AbiOutput[];
}

/**
 * ABI event item
 */
export interface AbiEvent {
  type: 'event';
  name: string;
  inputs: AbiEventInput[];
  anonymous?: boolean;
}

export interface AbiEventInput {
  name: string;
  type: string;
  indexed: boolean;
  internalType?: string;
}
