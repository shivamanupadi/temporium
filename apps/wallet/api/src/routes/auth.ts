import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { generateNonce } from '../lib/crypto';
import { generateToken } from '../lib/jwt';
import { challengeRequestSchema, verifyRequestSchema } from '../lib/validation';
import { BadRequestError, UnauthorizedError } from '../middleware/error';
import { success } from '../lib/response';
import { createTempoPublicClient } from '../lib/viem';
import type { Env, Variables } from '../types/env';

// SIWE message constants
const SIWE_DOMAIN = 'temporium.xyz';
const SIWE_URI = 'https://temporium.xyz';
const SIWE_VERSION = '1';
const CHALLENGE_EXPIRY_MINUTES = 5;

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Build a SIWE-compatible message
 */
function buildSiweMessage(params: {
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  chainId: number;
}): string {
  return `${SIWE_DOMAIN} wants you to sign in with your Tempo account:
${params.address}

Sign this message to authenticate with Temporium.

URI: ${SIWE_URI}
Version: ${SIWE_VERSION}
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}
Expiration Time: ${params.expirationTime}`;
}

/**
 * Parse and validate SIWE message
 */
function parseSiweMessage(message: string): {
  address: string;
  expirationTime: Date;
  issuedAt: Date;
} {
  // Extract expiration time
  const expirationMatch = message.match(
    /Expiration Time: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/
  );
  if (!expirationMatch) {
    throw new BadRequestError('Invalid message format: missing expiration time');
  }

  // Extract issued at time
  const issuedAtMatch = message.match(/Issued At: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/);
  if (!issuedAtMatch) {
    throw new BadRequestError('Invalid message format: missing issued at time');
  }

  // Extract address
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (!addressMatch) {
    throw new BadRequestError('Invalid message format: missing address');
  }

  return {
    address: addressMatch[0].toLowerCase(),
    expirationTime: new Date(expirationMatch[1]),
    issuedAt: new Date(issuedAtMatch[1]),
  };
}

/**
 * POST /auth/challenge
 * Generate a SIWE challenge for wallet authentication
 */
auth.post('/challenge', zValidator('json', challengeRequestSchema), async c => {
  const { address } = c.req.valid('json');

  const nonce = generateNonce(16);
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000);
  const issuedAt = new Date().toISOString();
  const expirationTime = expiresAt.toISOString();

  const message = buildSiweMessage({
    address,
    nonce,
    issuedAt,
    expirationTime,
    chainId: c.get('networkConfig').chain.id,
  });

  return success(c, {
    message,
    nonce,
    expiresAt: expiresAt.getTime(),
  });
});

/**
 * POST /auth/verify
 * Verify a SIWE signature and return a JWT token
 */
auth.post('/verify', zValidator('json', verifyRequestSchema), async c => {
  const { message, signature, address } = c.req.valid('json');

  // Parse and validate message
  const parsed = parseSiweMessage(message);

  // Validate expiration
  if (new Date() > parsed.expirationTime) {
    throw new UnauthorizedError('Challenge expired');
  }

  // Validate age (prevent replay attacks with old messages)
  const maxAge = CHALLENGE_EXPIRY_MINUTES * 60 * 1000;
  if (Date.now() - parsed.issuedAt.getTime() > maxAge) {
    throw new UnauthorizedError('Challenge too old');
  }

  // Validate address matches
  if (parsed.address !== address) {
    throw new UnauthorizedError('Address mismatch');
  }

  // Verify the signature using the public client, which supports both
  // EOA (ECDSA) and smart contract (EIP-1271) signatures
  try {
    const { rpcUrl, chain } = c.get('networkConfig');
    const publicClient = createTempoPublicClient(rpcUrl, chain);

    const isValid = await publicClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      throw new UnauthorizedError('Invalid signature');
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Signature verification error:', error);
    throw new UnauthorizedError('Invalid signature');
  }

  // Generate and return JWT token
  const tokenResponse = await generateToken(address, c.env.JWT_SECRET, c.env.JWT_EXPIRATION);

  return success(c, tokenResponse);
});

export default auth;
