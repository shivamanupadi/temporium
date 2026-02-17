import { z } from 'zod';

export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform(val => val.toLowerCase());

export const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex string');

export const cuid2Id = z.string().min(1, 'ID is required').max(30, 'Invalid ID format');

// ============ Auth Schemas ============

export const challengeRequestSchema = z.object({
  address: ethereumAddress,
});

export const verifyRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: hexString,
  address: ethereumAddress,
});

// ============ Project Schemas ============

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').trim(),
  templateId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').trim(),
});

// ============ File Schemas ============

export const createFileSchema = z.object({
  path: z.string().min(1, 'Path is required').max(500, 'Path too long').trim(),
  content: z.string().default(''),
});

export const updateFileSchema = z.object({
  path: z.string().min(1).max(500).trim().optional(),
  content: z.string().optional(),
});

// ============ Contract Schemas ============

export const createContractSchema = z.object({
  projectId: cuid2Id.optional(),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  address: ethereumAddress,
  abi: z.string().min(1, 'ABI is required'),
  bytecode: z.string().min(1, 'Bytecode is required'),
  txHash: z.string().optional(),
  constructorArgs: z.string().optional(),
  network: z.string().min(1, 'Network is required'),
  sourcePath: z.string().optional(),
});

// ============ Path Params ============

export const idParamSchema = z.object({
  id: cuid2Id,
});

export const fileIdParamSchema = z.object({
  id: cuid2Id,
  fileId: cuid2Id,
});
