import { z } from 'zod';

// ============ Common Validators ============

/**
 * Ethereum address validator (40 hex chars with 0x prefix)
 */
export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform(val => val.toLowerCase());

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
