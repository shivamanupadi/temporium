import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kv } from 'tempo.ts/server';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PasskeyRegistryABI } from './passkey-registry.abi';

/**
 * Tempo Testnet chain configuration
 */
const tempoTestnet = {
  id: 42429,
  name: 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.tempo.xyz'] },
  },
} as const;

/**
 * Keys Service - On-Chain Implementation
 *
 * Provides a tempo.ts compatible Kv interface backed by blockchain storage.
 * This eliminates the database as a single point of failure - users can
 * always recover access to their wallets as long as the blockchain exists.
 *
 * Features:
 * - Stores passkey public keys on-chain via PasskeyRegistry contract
 * - Supports fee sponsorship for gasless registration
 * - Free reads (view functions don't cost gas)
 * - Challenge generation remains stateless (random bytes)
 */
@Injectable()
export class KeysService implements Kv.Kv, OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private registryAddress: Address;
  private feeSponsorUrl: string | null = null;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'TEMPO_RPC_URL',
      'https://rpc.testnet.tempo.xyz',
    );

    this.registryAddress = this.configService.get<string>(
      'PASSKEY_REGISTRY_ADDRESS',
      '',
    ) as Address;

    this.feeSponsorUrl = this.configService.get<string>(
      'FEE_SPONSOR_URL',
      'https://sponsor.testnet.tempo.xyz',
    );

    // Initialize public client for reading from blockchain (free)
    this.publicClient = createPublicClient({
      chain: tempoTestnet,
      transport: http(rpcUrl),
    });

    // Initialize wallet client for writing (if relayer key provided)
    const relayerPrivateKey = this.configService.get<string>(
      'RELAYER_PRIVATE_KEY',
    );
    if (relayerPrivateKey) {
      const account = privateKeyToAccount(relayerPrivateKey as Hex);
      this.walletClient = createWalletClient({
        account,
        chain: tempoTestnet,
        transport: http(rpcUrl),
      });
      this.logger.log('Wallet client initialized with relayer account');
    }
  }

  onModuleInit() {
    if (!this.registryAddress || this.registryAddress === '0x...') {
      this.logger.warn(
        'PASSKEY_REGISTRY_ADDRESS not configured. On-chain storage disabled.',
      );
      this.logger.warn(
        'Deploy the PasskeyRegistry contract and set the address in .env',
      );
    } else {
      this.logger.log(
        `PasskeyRegistry configured at: ${this.registryAddress}`,
      );
    }
  }

  /**
   * Hash a credentialId to bytes32 for contract storage
   */
  private hashCredentialId(credentialId: string): Hex {
    return keccak256(toBytes(credentialId));
  }

  /**
   * Derive wallet address from public key
   * Uses last 20 bytes of keccak256(publicKey)
   */
  private deriveWalletAddress(publicKey: string): Address {
    const hash = keccak256(publicKey as Hex);
    return `0x${hash.slice(-40)}` as Address;
  }

  /**
   * Check if on-chain storage is available
   */
  private isOnChainEnabled(): boolean {
    return !!this.registryAddress && this.registryAddress !== '0x...';
  }

  /**
   * Get a value by key (credentialId) - READ FROM BLOCKCHAIN (FREE)
   *
   * Key format: "credential:{credentialId}" or "challenge:{random}"
   */
  async get<T = unknown>(key: string): Promise<T> {
    // Handle challenge keys (not stored on-chain)
    if (key.startsWith('challenge:')) {
      // Challenges are stateless - we don't store them
      // The tempo.ts library handles challenge verification
      return undefined as T;
    }

    // Extract credentialId from key
    const credentialId = key.replace('credential:', '');

    // If on-chain not configured, return undefined
    if (!this.isOnChainEnabled()) {
      this.logger.warn('On-chain storage not configured, returning undefined');
      return undefined as T;
    }

    try {
      const credentialIdHash = this.hashCredentialId(credentialId);

      // Read from blockchain (FREE - view function)
      const result = await this.publicClient.readContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'getPublicKey',
        args: [credentialIdHash],
      });

      const [publicKey, wallet, isActive] = result as [Hex, Address, boolean];

      // Check if passkey exists and is active
      if (!publicKey || publicKey === '0x' || !isActive) {
        this.logger.debug(`Passkey not found for credentialId: ${credentialId}`);
        return undefined as T;
      }

      this.logger.debug(`Retrieved passkey from chain for wallet: ${wallet}`);

      // Return in format expected by tempo.ts
      return publicKey as T;
    } catch (error) {
      this.logger.error(`Failed to read from blockchain: ${error}`);
      return undefined as T;
    }
  }

  /**
   * Set a value by key (store public key) - WRITE TO BLOCKCHAIN (SPONSORED)
   *
   * This registers a new passkey on-chain. The transaction fee is sponsored
   * so users don't need to have any funds to register.
   */
  async set(key: string, value: unknown): Promise<void> {
    // Handle challenge keys (not stored on-chain)
    if (key.startsWith('challenge:')) {
      // Challenges are stateless - we don't need to store them
      return;
    }

    // Extract credentialId from key
    const credentialId = key.replace('credential:', '');

    // If on-chain not configured, log warning
    if (!this.isOnChainEnabled()) {
      this.logger.warn(
        'On-chain storage not configured. Passkey NOT stored on-chain!',
      );
      this.logger.warn(
        'Set PASSKEY_REGISTRY_ADDRESS in .env to enable on-chain storage',
      );
      return;
    }

    // Check if we have a wallet client for writing
    if (!this.walletClient) {
      this.logger.error(
        'No wallet client configured. Set RELAYER_PRIVATE_KEY in .env',
      );
      throw new Error('Relayer not configured for on-chain registration');
    }

    try {
      // Parse the public key from value
      const publicKey =
        typeof value === 'string' ? value : (value as { publicKey?: string })?.publicKey || JSON.stringify(value);

      const credentialIdHash = this.hashCredentialId(credentialId);
      const wallet = this.deriveWalletAddress(publicKey);

      this.logger.log(`Registering passkey on-chain for wallet: ${wallet}`);

      // Write to blockchain (fee sponsored by relayer)
      const hash = await this.walletClient.writeContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'register',
        args: [credentialIdHash, publicKey as Hex, wallet],
      });

      this.logger.log(`Passkey registered on-chain. Tx: ${hash}`);
    } catch (error) {
      // Check if already registered (not an error)
      if (
        error instanceof Error &&
        error.message.includes('already registered')
      ) {
        this.logger.debug('Passkey already registered on-chain');
        return;
      }

      this.logger.error(`Failed to write to blockchain: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a key - DEACTIVATE ON BLOCKCHAIN
   *
   * Note: Only the wallet owner can deactivate their passkey.
   * This requires the wallet owner to sign the transaction.
   */
  async delete(key: string): Promise<void> {
    // For now, we don't support deletion from the API
    // Users must deactivate their own passkeys via the frontend
    this.logger.warn(
      'Delete operation not supported from API. Users must deactivate passkeys themselves.',
    );
  }

  /**
   * Generate a random challenge for WebAuthn authentication
   *
   * Challenges are stateless - we generate them on-demand and
   * verify them when the user responds. No storage needed.
   */
  generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  /**
   * Check if a passkey is registered on-chain
   */
  async isRegistered(credentialId: string): Promise<boolean> {
    if (!this.isOnChainEnabled()) {
      return false;
    }

    try {
      const credentialIdHash = this.hashCredentialId(credentialId);

      const result = await this.publicClient.readContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'isRegistered',
        args: [credentialIdHash],
      });

      return result as boolean;
    } catch (error) {
      this.logger.error(`Failed to check registration: ${error}`);
      return false;
    }
  }

  /**
   * Get all passkeys for a wallet address
   */
  async getWalletPasskeys(wallet: Address): Promise<Hex[]> {
    if (!this.isOnChainEnabled()) {
      return [];
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'getWalletPasskeys',
        args: [wallet],
      });

      return result as Hex[];
    } catch (error) {
      this.logger.error(`Failed to get wallet passkeys: ${error}`);
      return [];
    }
  }
}
