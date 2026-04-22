import { z } from 'zod';
import {
  policyTypeValues,
  transactionStatusValues,
  accessKeyTypeValues,
  paymentLinkStatusValues,
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

export const createAccessKeySchema = z.object({
  keyId: ethereumAddress,
  signatureType: accessKeyTypeSchema,
  txHash: transactionHash.optional(),
  label: z.string().max(100, 'Label must be 100 characters or less').trim().optional(),
});

export type CreateAccessKeyRequest = z.infer<typeof createAccessKeySchema>;

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
