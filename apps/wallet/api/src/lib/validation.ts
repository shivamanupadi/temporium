import { z } from 'zod';
import {
  policyTypeValues,
  transactionStatusValues,
  accessKeyTypeValues,
  paymentLinkStatusValues,
  recurringStatusValues,
} from '../db/schema';

// ============ Common Validators ============

/**
 * Ethereum address validator (40 hex chars with 0x prefix)
 */
export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform(val => val.toLowerCase());

/**
 * Transaction hash validator (64 hex chars with 0x prefix)
 */
export const transactionHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
  .transform(val => val.toLowerCase());

/**
 * CUID2 ID validator for path params
 */
export const cuid2Id = z.string().min(1, 'ID is required').max(30, 'Invalid ID format');

/**
 * Hex string validator (any length)
 */
export const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex string');

// ============ Auth Schemas ============

export const challengeRequestSchema = z.object({
  address: ethereumAddress,
});

export const verifyRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: hexString,
  address: ethereumAddress,
});

export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

// ============ Contacts Schemas ============

export const createContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  address: ethereumAddress,
});

export const updateContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
});

export type CreateContactRequest = z.infer<typeof createContactSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactSchema>;

// ============ TIP-20 Contracts Schemas ============

export const createTip20ContractSchema = z.object({
  address: ethereumAddress,
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol must be 20 characters or less')
    .trim()
    .toUpperCase(),
  currency: z.string().min(1, 'Currency is required').trim(),
  creator: ethereumAddress,
  txHash: transactionHash.optional(),
});

export type CreateTip20ContractRequest = z.infer<typeof createTip20ContractSchema>;

// ============ Custom Tokens Schemas ============

export const createCustomTokenSchema = z.object({
  address: ethereumAddress,
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol must be 20 characters or less')
    .trim(),
  decimals: z
    .number()
    .int('Decimals must be an integer')
    .min(0, 'Decimals must be non-negative')
    .max(18, 'Decimals must be 18 or less'),
  logoURI: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export type CreateCustomTokenRequest = z.infer<typeof createCustomTokenSchema>;

// ============ Access Keys Schemas ============

export const accessKeyTypeSchema = z.enum(accessKeyTypeValues);

// bytes4 function selector, e.g. "0xa9059cbb" (transfer)
export const selectorSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{8}$/, 'Invalid 4-byte function selector')
  .transform(val => val.toLowerCase());

export const createAccessKeySchema = z.object({
  keyId: ethereumAddress,
  signatureType: accessKeyTypeSchema,
  txHash: transactionHash.optional(),
  label: z.string().max(100, 'Label must be 100 characters or less').trim().optional(),
  notes: z.string().max(500, 'Notes must be 500 characters or less').trim().optional(),
});

export const updateAccessKeySchema = z
  .object({
    label: z.string().max(100, 'Label must be 100 characters or less').trim().optional(),
    notes: z.string().max(500, 'Notes must be 500 characters or less').trim().optional(),
  })
  .refine(d => d.label !== undefined || d.notes !== undefined, {
    message: 'At least one field (label, notes) must be provided',
  });

// Optional payload — caller may post empty body and we still record lastUsedAt = now().
export const touchAccessKeySchema = z
  .object({
    network: z.enum(['testnet', 'mainnet']).optional(),
  })
  .optional();

export type CreateAccessKeyRequest = z.infer<typeof createAccessKeySchema>;
export type UpdateAccessKeyRequest = z.infer<typeof updateAccessKeySchema>;

// ============ Policies Schemas ============

export const policyTypeSchema = z.enum(policyTypeValues);

export const createPolicySchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required').trim(),
  type: policyTypeSchema,
  admin: ethereumAddress,
  txHash: transactionHash.optional(),
});

export type CreatePolicyRequest = z.infer<typeof createPolicySchema>;

// ============ Scheduled Transactions Schemas ============

export const transactionStatusSchema = z.enum(transactionStatusValues);

export const createScheduledTxSchema = z.object({
  serializedTx: hexString.refine(val => val.length > 10, 'Serialized transaction is too short'),
  from: ethereumAddress,
  to: ethereumAddress,
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+$/, 'Amount must be a valid integer string'),
  token: ethereumAddress,
  tokenSymbol: z
    .string()
    .min(1, 'Token symbol is required')
    .max(20, 'Token symbol must be 20 characters or less')
    .trim(),
  tokenDecimals: z
    .number()
    .int('Token decimals must be an integer')
    .min(0, 'Token decimals must be non-negative')
    .max(18, 'Token decimals must be 18 or less'),
  feeToken: ethereumAddress,
  memo: z.string().max(500, 'Memo must be 500 characters or less').optional(),
  scheduledFor: z
    .string()
    .datetime({ message: 'Invalid scheduled date format' })
    .refine(date => new Date(date) > new Date(), 'Scheduled date must be in the future'),
});

export const updateScheduledTxSchema = z.object({
  status: transactionStatusSchema.optional(),
  executedAt: z.string().datetime({ message: 'Invalid executed date format' }).optional(),
});

export type CreateScheduledTxRequest = z.infer<typeof createScheduledTxSchema>;
export type UpdateScheduledTxRequest = z.infer<typeof updateScheduledTxSchema>;

// ============ Recurring Transactions Schemas ============

export const recurringStatusSchema = z.enum(recurringStatusValues);

// secp256k1 / p256 private keys are 32 bytes ⇒ 64 hex chars after 0x.
const accessKeyPrivateKey = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key (expected 32-byte hex)');

export const createRecurringTxSchema = z.object({
  accessKeyDbId: cuid2Id,
  accessKeyId: ethereumAddress,
  accessKeySignatureType: z.enum(['secp256k1', 'p256']), // webAuthn cannot sign server-side
  accessKeyPrivateKey,
  to: ethereumAddress,
  token: ethereumAddress,
  tokenSymbol: z.string().min(1).max(20).trim(),
  tokenDecimals: z.number().int().min(0).max(18),
  amount: z.string().min(1).regex(/^\d+$/, 'Amount must be a valid integer string'),
  feeToken: ethereumAddress,
  memo: z.string().max(500).optional(),
  intervalSeconds: z
    .number()
    .int('Interval must be an integer')
    .min(60, 'Interval must be at least 60 seconds')
    .max(365 * 24 * 60 * 60, 'Interval must be at most 1 year'),
  startAt: z.string().datetime({ message: 'Invalid start date format' }),
  endAt: z.string().datetime({ message: 'Invalid end date format' }).optional(),
  maxExecutions: z.number().int().min(1).max(10_000).optional(),
  label: z.string().max(100).trim().optional(),
  notes: z.string().max(500).trim().optional(),
});

export const updateRecurringTxSchema = z
  .object({
    label: z.string().max(100).trim().optional(),
    notes: z.string().max(500).trim().optional(),
    status: z.enum(['active', 'paused', 'cancelled']).optional(),
  })
  .refine(d => d.label !== undefined || d.notes !== undefined || d.status !== undefined, {
    message: 'At least one field (label, notes, status) must be provided',
  });

export const recurringTxQuerySchema = z.object({
  status: recurringStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateRecurringTxRequest = z.infer<typeof createRecurringTxSchema>;
export type UpdateRecurringTxRequest = z.infer<typeof updateRecurringTxSchema>;
export type RecurringTxQuery = z.infer<typeof recurringTxQuerySchema>;

// ============ Watched Spenders Schemas ============

export const createWatchedSpenderSchema = z.object({
  address: ethereumAddress,
  label: z.string().max(50, 'Label must be 50 characters or less').trim().optional(),
});

export type CreateWatchedSpenderRequest = z.infer<typeof createWatchedSpenderSchema>;

// ============ Pagination Schemas ============

export const scheduledTxQuerySchema = z.object({
  status: transactionStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ScheduledTxQuery = z.infer<typeof scheduledTxQuerySchema>;

// ============ Path Param Schemas ============

export const idParamSchema = z.object({
  id: cuid2Id,
});

export const addressParamSchema = z.object({
  address: ethereumAddress,
});

export const statusParamSchema = z.object({
  status: transactionStatusSchema,
});

export const policyTypeParamSchema = z.object({
  type: policyTypeSchema,
});

export const policyIdParamSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
});

// ============ Payment Links Schemas ============

export const paymentLinkStatusSchema = z.enum(paymentLinkStatusValues);

export const createPaymentLinkSchema = z.object({
  token: ethereumAddress,
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a valid decimal string')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than zero'),
  recipient: ethereumAddress,
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(80, 'Title must be 80 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').trim().optional(),
  reusable: z.boolean().optional().default(false),
  expiresAt: z
    .string()
    .datetime({ message: 'Invalid expiration date format' })
    .refine(date => new Date(date) > new Date(), 'Expiration must be in the future')
    .optional(),
});

export type CreatePaymentLinkRequest = z.infer<typeof createPaymentLinkSchema>;

export const paymentLinkQuerySchema = z.object({
  status: paymentLinkStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ Virtual Address (TIP-1022) Schemas ============

const hexLength = (bytes: number) => new RegExp(`^0x[a-fA-F0-9]{${bytes * 2}}$`);

export const hex4Schema = z
  .string()
  .regex(hexLength(4), 'Expected 4-byte hex (0x + 8 chars)')
  .transform(val => val.toLowerCase());

export const hex6Schema = z
  .string()
  .regex(hexLength(6), 'Expected 6-byte hex (0x + 12 chars)')
  .transform(val => val.toLowerCase());

export const hex32Schema = z
  .string()
  .regex(hexLength(32), 'Expected 32-byte hex (0x + 64 chars)')
  .transform(val => val.toLowerCase());

export const networkSchema = z.enum(['testnet', 'mainnet']);

export const registerVirtualMasterSchema = z.object({
  masterId: hex4Schema,
  salt: hex32Schema,
  txHash: transactionHash,
  network: networkSchema,
});

export const createVirtualAddressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(64, 'Label must be 64 characters or less'),
});

export const lookupVirtualMasterSchema = z.object({
  masterId: hex4Schema,
});

export const importVirtualAddressSchema = z.object({
  address: ethereumAddress,
  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(64, 'Label must be 64 characters or less'),
});

export type RegisterVirtualMasterRequest = z.infer<typeof registerVirtualMasterSchema>;
export type LookupVirtualMasterRequest = z.infer<typeof lookupVirtualMasterSchema>;
export type CreateVirtualAddressRequest = z.infer<typeof createVirtualAddressSchema>;
export type ImportVirtualAddressRequest = z.infer<typeof importVirtualAddressSchema>;
