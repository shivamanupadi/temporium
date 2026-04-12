import { Hono } from 'hono';
import { Handler, Kv } from 'accounts/server';
import { keccak256 } from 'viem';
import {
  createTempoPublicClient,
  createTempoWalletClient,
  hashCredentialId,
  validateAndNormalizePublicKey,
  normalizePublicKey,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from '../lib/viem';
import { randomNonceKey } from '../lib/nonce';
import { PasskeyRegistryABI } from '../lib/passkey-registry';
import { generateToken } from '../lib/jwt';
import {
  ServiceUnavailableError,
  ExternalServiceError,
  BadRequestError,
  ConflictError,
} from '../middleware/error';
import { getTempoChain, getRpcUrl } from '../lib/chain';
import type { Env, Variables } from '../types/env';

/**
 * Challenge expiration time in seconds (5 minutes)
 */
const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * Maximum challenges to store (prevent memory issues)
 */
const MAX_CHALLENGES = 10000;

/**
 * Module-level challenge storage - persists across requests within the same Worker isolate
 */
const globalChallenges = new Map<string, number>();

/**
 * Cleanup expired challenges (called periodically)
 */
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [challenge, timestamp] of globalChallenges.entries()) {
    if (now - timestamp > CHALLENGE_TTL_SECONDS * 1000) {
      globalChallenges.delete(challenge);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired challenges (remaining: ${globalChallenges.size})`);
  }
}

/**
 * Derive wallet address from public key (same as contract)
 */
function deriveWalletAddress(publicKey: string): string {
  try {
    const normalized = normalizePublicKey(publicKey);
    const hash = keccak256(normalized);
    return `0x${hash.slice(-40)}`.toLowerCase();
  } catch (error) {
    console.error('Failed to derive wallet address:', error);
    throw new BadRequestError('Invalid public key format');
  }
}

/**
 * Create a Kv adapter backed by the PasskeyRegistry smart contract.
 *
 * - Challenges are stored in an in-memory Map (same Worker isolate).
 * - Credentials (public keys) are stored on-chain in the PasskeyRegistry contract.
 *
 * This implements the accounts SDK Kv interface:
 *   get(key) / set(key, value) / delete(key)
 *
 * Key prefixes:
 *   "challenge:<hex>"       → in-memory challenge timestamp
 *   "credential:<credId>"   → on-chain public key ({ publicKey })
 */
function createOnChainKv(env: Pick<Env, 'PASSKEY_REGISTRY_CONTRACT' | 'RELAYER_PRIVATE_KEY'>) {
  const mainnetChain = getTempoChain('mainnet');
  const mainnetRpcUrl = getRpcUrl(mainnetChain);

  const registryAddress = env.PASSKEY_REGISTRY_CONTRACT as Address;
  const publicClient: PublicClient = createTempoPublicClient(mainnetRpcUrl, mainnetChain);

  let walletClient: WalletClient | null = null;
  if (env.RELAYER_PRIVATE_KEY) {
    walletClient = createTempoWalletClient(mainnetRpcUrl, env.RELAYER_PRIVATE_KEY, mainnetChain);
  }

  const isOnChainEnabled = (): boolean => !!registryAddress && registryAddress !== '0x...';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Kv.from({
    async get(key: string): Promise<any> {
      // Challenge keys → in-memory map
      if (key.startsWith('challenge:')) {
        const challenge = key.replace('challenge:', '');
        const timestamp = globalChallenges.get(challenge);

        if (timestamp) {
          const age = Date.now() - timestamp;
          if (age <= CHALLENGE_TTL_SECONDS * 1000) {
            return timestamp;
          }
          globalChallenges.delete(challenge);
        }
        return undefined;
      }

      // Credential keys → on-chain lookup
      const credentialId = key.replace('credential:', '');

      if (!isOnChainEnabled()) {
        return undefined;
      }

      try {
        const credentialIdHash = hashCredentialId(credentialId);

        const result = await publicClient.readContract({
          address: registryAddress,
          abi: PasskeyRegistryABI,
          functionName: 'getPublicKey',
          args: [credentialIdHash],
        });

        const [publicKey, wallet] = result as [Hex, Address, bigint];

        if (publicKey && publicKey !== '0x') {
          console.log(`Retrieved passkey from chain for wallet: ${wallet}`);
          return { publicKey };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to read from blockchain:', errorMessage);
        throw new ExternalServiceError(
          'Failed to retrieve passkey from blockchain',
          'PasskeyRegistry'
        );
      }

      console.log(`Passkey not found for credentialId: ${credentialId}`);
      return undefined;
    },

    async set(key: string, value: unknown) {
      // Challenge keys → in-memory map
      if (key.startsWith('challenge:')) {
        const challenge = key.replace('challenge:', '');

        if (globalChallenges.size >= MAX_CHALLENGES) {
          cleanupExpiredChallenges();
          if (globalChallenges.size >= MAX_CHALLENGES) {
            console.warn('Challenge storage at capacity, rejecting new challenge');
            throw new Error('Service temporarily at capacity. Please try again.');
          }
        }

        globalChallenges.set(challenge, value as number);
        if (globalChallenges.size % 100 === 0) {
          cleanupExpiredChallenges();
        }
        console.log(
          `Challenge stored: ${challenge.substring(0, 16)}... (total: ${globalChallenges.size})`
        );
        return;
      }

      // Credential keys → on-chain registration
      const credentialId = key.replace('credential:', '');

      if (!isOnChainEnabled()) {
        console.warn('On-chain storage not configured');
        throw new Error('Passkey registration service not configured');
      }

      if (!walletClient) {
        throw new Error('Relayer not configured for on-chain registration');
      }

      try {
        const publicKey =
          typeof value === 'object' && value !== null && 'publicKey' in value
            ? (value as { publicKey: string }).publicKey
            : typeof value === 'string'
              ? value
              : JSON.stringify(value);

        const normalizedPublicKey = validateAndNormalizePublicKey(publicKey);
        const credentialIdHash = hashCredentialId(credentialId);

        console.log(`Registering passkey on-chain for credentialId: ${credentialId}`);

        const hash = await walletClient.writeContract({
          chain: mainnetChain,
          account: walletClient.account!,
          address: registryAddress,
          abi: PasskeyRegistryABI,
          functionName: 'register',
          args: [credentialIdHash, normalizedPublicKey],
          nonceKey: randomNonceKey(),
          nonce: 0,
        } as any);

        console.log(`Transaction submitted: ${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status === 'success') {
          console.log(`Passkey registered on-chain. Tx: ${hash}`);
        } else {
          throw new Error('Transaction reverted');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('key already registered')
        ) {
          console.log('Passkey already registered on-chain');
          throw new Error('Passkey already registered');
        }
        if (errorMessage.includes('not owner')) {
          console.error('Wallet not authorized as owner on PasskeyRegistry contract');
          throw new Error('Registration service not configured correctly');
        }
        if (
          errorMessage.includes('invalid key length') ||
          errorMessage.includes('Invalid public key')
        ) {
          throw new Error('Invalid passkey format');
        }

        console.error('Failed to write to blockchain:', errorMessage);
        throw new Error('Failed to register passkey. Please try again.');
      }
    },

    async delete(key: string) {
      if (key.startsWith('challenge:')) {
        const challenge = key.replace('challenge:', '');
        globalChallenges.delete(challenge);
        console.log(
          `Challenge consumed: ${challenge.substring(0, 16)}... (remaining: ${globalChallenges.size})`
        );
      }
    },
  });
}

/**
 * Get the rpId for WebAuthn from the request origin
 */
function getRpId(request: Request): string {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    const parts = hostname.split('.');
    const specialSuffixes = ['pages.dev', 'workers.dev', 'co.uk', 'com.au', 'co.nz'];
    for (const suffix of specialSuffixes) {
      if (hostname.endsWith(`.${suffix}`)) {
        const suffixParts = suffix.split('.').length;
        return parts.slice(-(suffixParts + 1)).join('.');
      }
    }

    return parts.slice(-2).join('.');
  } catch {
    return 'localhost';
  }
}

const keysRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Handle all /keys/* requests via accounts SDK Handler.webAuthn
 */
keysRouter.all('/*', async c => {
  const kv = createOnChainKv(c.env);
  const rpId = getRpId(c.req.raw);
  const origin = c.req.header('origin') || 'http://localhost';

  const handler = Handler.webAuthn({
    kv,
    rpId,
    origin,
    challengeTtl: CHALLENGE_TTL_SECONDS,
    path: '',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Tempo-Network',
    },
    onRegister: (async ({
      publicKey,
    }: {
      credentialId: string;
      publicKey: string;
      request: Request;
    }) => {
      try {
        const walletAddress = deriveWalletAddress(publicKey);
        const token = await generateToken(walletAddress, c.env.JWT_SECRET, c.env.JWT_EXPIRATION);
        console.log(`Generated JWT token for wallet: ${walletAddress} (register)`);
        return Response.json({ ...token, walletAddress });
      } catch (error) {
        console.error('Failed to generate token on register:', error);
      }
    }) as any,
    onAuthenticate: (async ({
      publicKey,
    }: {
      credentialId: string;
      publicKey: string;
      request: Request;
    }) => {
      try {
        const walletAddress = deriveWalletAddress(publicKey);
        const token = await generateToken(walletAddress, c.env.JWT_SECRET, c.env.JWT_EXPIRATION);
        console.log(`Generated JWT token for wallet: ${walletAddress} (authenticate)`);
        return Response.json({ ...token, walletAddress });
      } catch (error) {
        console.error('Failed to generate token on authenticate:', error);
      }
    }) as any,
  });

  // Get the path after /keys/
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/keys\/?/, '');

  // Build the request URL for the handler
  const requestUrl = `${url.origin}/${path}${url.search}`;

  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  let body: ArrayBuffer | undefined;
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS') {
    try {
      body = await c.req.arrayBuffer();
    } catch {
      // No body
    }
  }

  const fetchRequest = new Request(requestUrl, {
    method: c.req.method,
    headers,
    body,
  });

  try {
    const response = await handler.fetch(fetchRequest);
    const responseBody = await response.text();

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (
      error instanceof ServiceUnavailableError ||
      error instanceof ExternalServiceError ||
      error instanceof BadRequestError ||
      error instanceof ConflictError
    ) {
      throw error;
    }
    console.error('accounts SDK handler error:', error);
    throw new ExternalServiceError('Passkey service error', 'accounts');
  }
});

export default keysRouter;
