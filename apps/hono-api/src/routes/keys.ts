import { Hono } from 'hono';
import { Handler, Kv } from 'tempo.ts/server';
import { keccak256 } from 'viem';
import {
  createTempoPublicClient,
  createTempoWalletClient,
  hashCredentialId,
  validateAndNormalizePublicKey,
  normalizePublicKey,
  tempoTestnet,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from '../lib/viem';
import { PasskeyRegistryABI } from '../lib/passkey-registry';
import { generateToken } from '../lib/jwt';
import {
  ServiceUnavailableError,
  ExternalServiceError,
  BadRequestError,
  ConflictError,
} from '../middleware/error';
import type { Env, Variables } from '../types/env';

/**
 * Challenge expiration time in milliseconds (5 minutes)
 */
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Maximum challenges to store (prevent memory issues)
 */
const MAX_CHALLENGES = 10000;

/**
 * Endpoints that should not receive JWT tokens
 */
const EXCLUDED_ENDPOINTS = ['challenge'];

/**
 * Module-level challenge storage - persists across requests within the same Worker isolate
 * This is necessary because Workers create new service instances per request
 */
const globalChallenges = new Map<string, number>();

/**
 * Cleanup expired challenges (called periodically)
 */
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [challenge, timestamp] of globalChallenges.entries()) {
    if (now - timestamp > CHALLENGE_EXPIRATION_MS) {
      globalChallenges.delete(challenge);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired challenges (remaining: ${globalChallenges.size})`);
  }
}

/**
 * KeysService - Implements tempo.ts Kv interface backed by blockchain
 */
class KeysService implements Kv.Kv {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private registryAddress: Address;

  constructor(private env: Env) {
    this.registryAddress = env.PASSKEY_REGISTRY_ADDRESS as Address;
    this.publicClient = createTempoPublicClient(env.TEMPO_RPC_URL);

    if (env.RELAYER_PRIVATE_KEY) {
      this.walletClient = createTempoWalletClient(env.TEMPO_RPC_URL, env.RELAYER_PRIVATE_KEY);
    }
  }

  private isOnChainEnabled(): boolean {
    return !!this.registryAddress && this.registryAddress !== '0x...';
  }

  async get<T = unknown>(key: string): Promise<T> {
    // Handle challenge keys - use global map
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');
      const timestamp = globalChallenges.get(challenge);

      if (timestamp) {
        const age = Date.now() - timestamp;
        if (age <= CHALLENGE_EXPIRATION_MS) {
          return '1' as T;
        }
        globalChallenges.delete(challenge);
      }
      return undefined as T;
    }

    // Extract credentialId from key
    const credentialId = key.replace('credential:', '');

    if (this.isOnChainEnabled()) {
      try {
        const credentialIdHash = hashCredentialId(credentialId);

        const result = await this.publicClient.readContract({
          address: this.registryAddress,
          abi: PasskeyRegistryABI,
          functionName: 'getPublicKey',
          args: [credentialIdHash],
        });

        const [publicKey, wallet] = result as [Hex, Address, bigint];

        if (publicKey && publicKey !== '0x') {
          console.log(`Retrieved passkey from chain for wallet: ${wallet}`);
          return publicKey as T;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to read from blockchain:', errorMessage);
        throw new ExternalServiceError(
          'Failed to retrieve passkey from blockchain',
          'PasskeyRegistry'
        );
      }
    }

    console.log(`Passkey not found for credentialId: ${credentialId}`);
    return undefined as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    // Store challenges in global map (persists across requests)
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');

      // Prevent unbounded growth
      if (globalChallenges.size >= MAX_CHALLENGES) {
        cleanupExpiredChallenges();

        // If still too many after cleanup, reject
        if (globalChallenges.size >= MAX_CHALLENGES) {
          console.warn('Challenge storage at capacity, rejecting new challenge');
          throw new ServiceUnavailableError('Service temporarily at capacity. Please try again.');
        }
      }

      globalChallenges.set(challenge, Date.now());
      // Cleanup old challenges periodically
      if (globalChallenges.size % 100 === 0) {
        cleanupExpiredChallenges();
      }
      console.log(
        `Challenge stored: ${challenge.substring(0, 16)}... (total: ${globalChallenges.size})`
      );
      return;
    }

    const credentialId = key.replace('credential:', '');

    if (!this.isOnChainEnabled()) {
      console.warn('On-chain storage not configured');
      throw new ServiceUnavailableError('Passkey registration service not configured');
    }

    if (!this.walletClient) {
      throw new ServiceUnavailableError('Relayer not configured for on-chain registration');
    }

    try {
      const rawPublicKey =
        typeof value === 'string'
          ? value
          : (value as { publicKey?: string })?.publicKey || JSON.stringify(value);

      const normalizedPublicKey = validateAndNormalizePublicKey(rawPublicKey);
      const credentialIdHash = hashCredentialId(credentialId);

      console.log(`Registering passkey on-chain for credentialId: ${credentialId}`);

      const hash = await this.walletClient.writeContract({
        chain: tempoTestnet,
        account: this.walletClient.account!,
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'register',
        args: [credentialIdHash, normalizedPublicKey],
      });

      console.log(`Transaction submitted: ${hash}`);

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === 'success') {
        console.log(`Passkey registered on-chain. Tx: ${hash}`);
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableError || error instanceof BadRequestError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle specific blockchain errors
      if (errorMessage.includes('already registered')) {
        console.log('Passkey already registered on-chain');
        throw new ConflictError('Passkey already registered');
      }
      if (errorMessage.includes('not owner')) {
        console.error('Wallet not authorized as owner on PasskeyRegistry contract');
        throw new ServiceUnavailableError('Registration service not configured correctly');
      }
      if (errorMessage.includes('key already registered')) {
        throw new ConflictError('This passkey is already registered');
      }
      if (
        errorMessage.includes('invalid key length') ||
        errorMessage.includes('Invalid public key')
      ) {
        throw new BadRequestError('Invalid passkey format');
      }

      console.error('Failed to write to blockchain:', errorMessage);
      throw new ExternalServiceError(
        'Failed to register passkey. Please try again.',
        'PasskeyRegistry'
      );
    }
  }

  async delete(key: string): Promise<void> {
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');
      globalChallenges.delete(challenge);
      console.log(
        `Challenge consumed: ${challenge.substring(0, 16)}... (remaining: ${globalChallenges.size})`
      );
    }
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

const keysRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Handle all /keys/* requests via tempo.ts Handler.keyManager
 */
keysRouter.all('/*', async c => {
  const keysService = new KeysService(c.env);

  // Create tempo.ts key manager handler
  const keysHandler = Handler.keyManager({
    kv: keysService,
    path: '',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

  // Get the path after /keys/
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/keys\/?/, '');

  // Build the request URL for tempo.ts handler
  const requestUrl = `${url.origin}/${path}${url.search}`;

  // Create a fetch Request from the Hono request
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
    body: body,
  });

  // Call tempo.ts handler
  let response: Response;
  try {
    response = await keysHandler.fetch(fetchRequest);
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof ServiceUnavailableError ||
      error instanceof ExternalServiceError ||
      error instanceof BadRequestError ||
      error instanceof ConflictError
    ) {
      throw error;
    }
    console.error('tempo.ts handler error:', error);
    throw new ExternalServiceError('Passkey service error', 'tempo.ts');
  }

  const responseBody = await response.text();

  // Extract credentialId from path
  const credentialId = path.split('/')[0];

  // Check if we should inject JWT token
  const isSuccessful = response.status >= 200 && response.status < 300;
  const hasCredentialId = Boolean(credentialId);
  const isExcluded = EXCLUDED_ENDPOINTS.includes(credentialId);

  if (isSuccessful && hasCredentialId && !isExcluded) {
    let publicKey: string | undefined;

    try {
      if (c.req.method === 'POST') {
        // After registration, get the public key from the service
        publicKey = await keysService.get<string>(`credential:${credentialId}`);
      } else if (c.req.method === 'GET' && responseBody) {
        // Parse public key from response
        try {
          const data = JSON.parse(responseBody);
          publicKey = data.publicKey;
        } catch {
          // Not JSON or no publicKey field
        }
      }

      if (publicKey) {
        // Derive wallet address from public key
        const walletAddress = deriveWalletAddress(publicKey);

        // Generate JWT token
        const token = await generateToken(walletAddress, c.env.JWT_SECRET, c.env.JWT_EXPIRATION);

        console.log(`Generated JWT token for wallet: ${walletAddress}`);

        // Return response in tempo.ts expected format (NOT wrapped)
        // The frontend KeyManager expects { publicKey, accessToken, expiresIn } directly
        return c.json({
          publicKey,
          ...token,
        });
      }
    } catch (error) {
      // Re-throw our custom errors
      if (
        error instanceof BadRequestError ||
        error instanceof ServiceUnavailableError ||
        error instanceof ExternalServiceError ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      console.error('Failed to create authenticated response:', error);
    }
  }

  // Return original response from tempo.ts handler
  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    responseHeaders.set(key, value);
  });

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
});

export default keysRouter;
