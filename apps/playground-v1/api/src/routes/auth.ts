import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { verifyMessage } from 'viem';
import { generateNonce } from '../lib/crypto';
import { generateToken } from '../lib/jwt';
import { challengeRequestSchema, verifyRequestSchema } from '../lib/validation';
import { BadRequestError, UnauthorizedError } from '../middleware/error';
import { success } from '../lib/response';
import type { Env, Variables } from '../types/env';

const SIWE_DOMAIN = 'playground.temporium.xyz';
const SIWE_URI = 'https://playground.temporium.xyz';
const SIWE_VERSION = '1';
const CHALLENGE_EXPIRY_MINUTES = 5;

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function buildSiweMessage(params: {
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  chainId: number;
}): string {
  return `${SIWE_DOMAIN} wants you to sign in with your Ethereum account:
${params.address}

Sign this message to authenticate with Temporium Playground.

URI: ${SIWE_URI}
Version: ${SIWE_VERSION}
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}
Expiration Time: ${params.expirationTime}`;
}

function parseSiweMessage(message: string) {
  const expirationMatch = message.match(
    /Expiration Time: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/
  );
  if (!expirationMatch) throw new BadRequestError('Invalid message format: missing expiration time');

  const issuedAtMatch = message.match(/Issued At: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/);
  if (!issuedAtMatch) throw new BadRequestError('Invalid message format: missing issued at time');

  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (!addressMatch) throw new BadRequestError('Invalid message format: missing address');

  return {
    address: addressMatch[0].toLowerCase(),
    expirationTime: new Date(expirationMatch[1]),
    issuedAt: new Date(issuedAtMatch[1]),
  };
}

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

  return success(c, { message, nonce, expiresAt: expiresAt.getTime() });
});

auth.post('/verify', zValidator('json', verifyRequestSchema), async c => {
  const { message, signature, address } = c.req.valid('json');

  const parsed = parseSiweMessage(message);

  if (new Date() > parsed.expirationTime) {
    throw new UnauthorizedError('Challenge expired');
  }

  const maxAge = CHALLENGE_EXPIRY_MINUTES * 60 * 1000;
  if (Date.now() - parsed.issuedAt.getTime() > maxAge) {
    throw new UnauthorizedError('Challenge too old');
  }

  if (parsed.address !== address) {
    throw new UnauthorizedError('Address mismatch');
  }

  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) throw new UnauthorizedError('Invalid signature');
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid signature');
  }

  const tokenResponse = await generateToken(address, c.env.JWT_SECRET, c.env.JWT_EXPIRATION);

  return success(c, tokenResponse);
});

export default auth;
