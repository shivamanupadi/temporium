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
 * Minimum relayer balance in native currency (0.1 USD)
 * Below this threshold, warnings are logged
 */
const MIN_RELAYER_BALANCE = BigInt(100000); // 0.1 USD with 6 decimals

/**
 * Challenge expiration time in milliseconds (5 minutes)
 */
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Cleanup interval for expired challenges (1 minute)
 */
const CHALLENGE_CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Keys Service - Fully Decentralized Implementation
 *
 * Provides a tempo.ts compatible Kv interface backed entirely by blockchain storage.
 * No database dependency - users can always recover access to their wallets
 * as long as the blockchain exists.
 *
 * Features:
 * - Stores passkey public keys on-chain via PasskeyRegistry contract
 * - In-memory challenge storage (ephemeral, no DB needed)
 * - Supports fee sponsorship for gasless registration
 * - Free reads (view functions don't cost gas)
 *
 * Security:
 * - Only authorized relayers can register passkeys
 * - Wallet address is derived on-chain from public key (tamper-proof)
 * - Challenges are single-use and expire after 5 minutes
 * - Contract can be paused in case of emergency
 */
@Injectable()
export class KeysService implements Kv.Kv, OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private registryAddress: Address;

  /**
   * In-memory challenge storage: challenge -> timestamp
   * Challenges are ephemeral (5 min TTL) and don't need persistence
   */
  private challenges = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'TEMPO_RPC_URL',
      'https://rpc.testnet.tempo.xyz',
    );

    this.registryAddress = this.configService.get<string>(
      'PASSKEY_REGISTRY_ADDRESS',
      '',
    ) as Address;

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

    // Start periodic cleanup of expired challenges
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredChallenges();
    }, CHALLENGE_CLEANUP_INTERVAL_MS);
  }

  async onModuleInit() {
    if (!this.registryAddress || this.registryAddress === '0x...') {
      this.logger.warn(
        'PASSKEY_REGISTRY_ADDRESS not configured. On-chain storage disabled.',
      );
      this.logger.warn(
        'Deploy the PasskeyRegistry contract and set the address in .env',
      );
    } else {
      this.logger.log(`PasskeyRegistry configured at: ${this.registryAddress}`);
    }

    // Check relayer balance on startup
    await this.checkRelayerBalance();
  }

  /**
   * Check relayer balance and log warnings if low
   */
  private async checkRelayerBalance(): Promise<void> {
    if (!this.walletClient?.account) {
      return;
    }

    try {
      const balance = await this.publicClient.getBalance({
        address: this.walletClient.account.address,
      });

      const balanceFormatted = Number(balance) / 1e6; // Convert to USD (6 decimals)

      if (balance < MIN_RELAYER_BALANCE) {
        this.logger.error(
          `CRITICAL: Relayer balance is low: ${balanceFormatted.toFixed(2)} USD. ` +
            `Passkey registrations may fail! Please top up: ${this.walletClient.account.address}`,
        );
      } else {
        this.logger.log(
          `Relayer balance: ${balanceFormatted.toFixed(2)} USD (${this.walletClient.account.address})`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check relayer balance: ${error}`);
    }
  }

  /**
   * Get current relayer balance
   */
  async getRelayerBalance(): Promise<{
    address: string;
    balance: string;
    isLow: boolean;
  } | null> {
    if (!this.walletClient?.account) {
      return null;
    }

    try {
      const balance = await this.publicClient.getBalance({
        address: this.walletClient.account.address,
      });

      return {
        address: this.walletClient.account.address,
        balance: balance.toString(),
        isLow: balance < MIN_RELAYER_BALANCE,
      };
    } catch (error) {
      this.logger.error(`Failed to get relayer balance: ${error}`);
      return null;
    }
  }

  /**
   * Hash a credentialId to bytes32 for contract storage
   */
  private hashCredentialId(credentialId: string): Hex {
    return keccak256(toBytes(credentialId));
  }

  /**
   * Check if on-chain storage is available
   */
  private isOnChainEnabled(): boolean {
    return !!this.registryAddress && this.registryAddress !== '0x...';
  }

  /**
   * Normalize a P256 public key to 64 bytes (without 0x04 prefix)
   * This matches the format expected by the PasskeyRegistry contract
   */
  private normalizePublicKey(publicKey: string): Hex {
    const hexPart = publicKey.slice(2); // Remove 0x prefix

    // If 130 chars (65 bytes with 0x04 prefix), strip the 04 prefix
    if (hexPart.length === 130 && hexPart.startsWith('04')) {
      return `0x${hexPart.slice(2)}`;
    }

    // If already 128 chars (64 bytes), return as-is
    if (hexPart.length === 128) {
      return publicKey as Hex;
    }

    throw new Error(
      `Invalid public key: expected 64 or 65 bytes, got ${hexPart.length / 2} bytes`,
    );
  }

  /**
   * Validate and normalize public key format
   * Returns the normalized 64-byte public key
   */
  private validateAndNormalizePublicKey(publicKey: string): Hex {
    // Must start with 0x
    if (!publicKey.startsWith('0x')) {
      throw new Error('Invalid public key: must start with 0x');
    }

    // Must be valid hex
    const hexPart = publicKey.slice(2);
    if (!/^[a-fA-F0-9]+$/.test(hexPart)) {
      throw new Error('Invalid public key: must be valid hexadecimal');
    }

    // Normalize to 64 bytes (will throw if invalid length)
    return this.normalizePublicKey(publicKey);
  }

  /**
   * Get a value by key (credentialId) - READ FROM BLOCKCHAIN
   *
   * Key format: "credential:{credentialId}" or "challenge:{challenge}"
   *
   * For challenges: Checks in-memory storage and expiration
   * For credentials: Reads from blockchain
   */
  async get<T = unknown>(key: string): Promise<T> {
    // Handle challenge keys - check in-memory storage
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');
      const timestamp = this.challenges.get(challenge);

      if (timestamp) {
        const age = Date.now() - timestamp;
        if (age <= CHALLENGE_EXPIRATION_MS) {
          // Return truthy value (tempo.ts just checks if it exists)
          return '1' as T;
        }
        // Expired - clean up
        this.challenges.delete(challenge);
      }

      return undefined as T;
    }

    // Extract credentialId from key
    const credentialId = key.replace('credential:', '');

    // Read from blockchain if configured
    if (this.isOnChainEnabled()) {
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
        if (publicKey && publicKey !== '0x' && isActive) {
          this.logger.debug(
            `Retrieved passkey from chain for wallet: ${wallet}`,
          );
          return publicKey as T;
        }
      } catch (error) {
        this.logger.error(`Failed to read from blockchain: ${error}`);
      }
    }

    this.logger.debug(`Passkey not found for credentialId: ${credentialId}`);
    return undefined as T;
  }

  /**
   * Set a value by key (store public key) - WRITE TO BLOCKCHAIN ONLY
   *
   * This registers a new passkey on-chain (permanent, decentralized).
   * The transaction fee for blockchain is sponsored so users don't need funds.
   *
   * Note: The contract derives the wallet address from the public key on-chain,
   * ensuring the mapping cannot be tampered with.
   *
   * Challenges are stored in-memory with TTL (no database needed).
   */
  async set(key: string, value: unknown): Promise<void> {
    // Store challenges in memory with timestamp
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');
      this.challenges.set(challenge, Date.now());
      this.logger.debug(`Challenge stored: ${challenge.substring(0, 16)}...`);
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
      const rawPublicKey =
        typeof value === 'string'
          ? value
          : (value as { publicKey?: string })?.publicKey ||
            JSON.stringify(value);

      // Validate and normalize public key format before sending to blockchain
      const normalizedPublicKey =
        this.validateAndNormalizePublicKey(rawPublicKey);

      const credentialIdHash = this.hashCredentialId(credentialId);

      this.logger.log(
        `Registering passkey on-chain for credentialId: ${credentialId}`,
      );

      // Write to blockchain (fee sponsored by relayer)
      // Note: Contract derives wallet address from publicKey on-chain
      const hash = await this.walletClient.writeContract({
        chain: tempoTestnet,
        account: this.walletClient.account!,
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'register',
        args: [credentialIdHash, normalizedPublicKey],
      });

      this.logger.log(`Transaction submitted: ${hash}`);

      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === 'success') {
        this.logger.log(`Passkey registered on-chain. Tx: ${hash}`);
      } else {
        this.logger.error(`Transaction failed. Tx: ${hash}`);
        throw new Error('Transaction failed');
      }
    } catch (error) {
      // Check if already registered (not an error)
      if (
        error instanceof Error &&
        error.message.includes('already registered')
      ) {
        this.logger.debug('Passkey already registered on-chain');
        return;
      }

      // Check for relayer not authorized error
      if (
        error instanceof Error &&
        error.message.includes('not authorized relayer')
      ) {
        this.logger.error(
          'Relayer is not authorized. The contract owner must call setRelayer() to authorize this relayer.',
        );
        // Generic error message for client
        throw new Error('Registration service temporarily unavailable');
      }

      // Check for contract paused error
      if (error instanceof Error && error.message.includes('paused')) {
        this.logger.error(
          'Contract is paused. Registration is temporarily disabled.',
        );
        // Generic error message for client
        throw new Error('Registration service temporarily unavailable');
      }

      // Check for max passkeys limit
      if (
        error instanceof Error &&
        error.message.includes('max passkeys reached')
      ) {
        this.logger.warn('User has reached maximum passkeys limit');
        throw new Error('Maximum number of passkeys reached for this wallet');
      }

      // Check for invalid public key error
      if (
        error instanceof Error &&
        error.message.includes('Invalid public key')
      ) {
        this.logger.error(`Invalid public key format: ${error.message}`);
        throw new Error('Invalid passkey format');
      }

      this.logger.error(`Failed to write to blockchain: ${error}`);
      // Generic error for unexpected failures
      throw new Error('Failed to register passkey. Please try again.');
    }
  }

  /**
   * Delete a key
   *
   * For challenges: Removes from in-memory storage (prevents replay)
   * For passkeys: No-op (deletion intentionally disabled for security)
   */
  delete(key: string): Promise<void> {
    // Delete challenges from memory (prevents replay attacks)
    if (key.startsWith('challenge:')) {
      const challenge = key.replace('challenge:', '');
      this.challenges.delete(challenge);
      this.logger.debug(`Challenge consumed: ${challenge.substring(0, 16)}...`);
    }

    // Passkeys cannot be deleted - no-op
    return Promise.resolve();
  }

  /**
   * Cleanup expired challenges from memory
   * Called periodically by the cleanup interval
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [challenge, timestamp] of this.challenges.entries()) {
      if (now - timestamp > CHALLENGE_EXPIRATION_MS) {
        this.challenges.delete(challenge);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired challenges`);
    }
  }

  /**
   * Get current challenge count (for monitoring)
   */
  getChallengeCount(): number {
    return this.challenges.size;
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

      return result;
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

  /**
   * Check if the contract is paused
   */
  async isPaused(): Promise<boolean> {
    if (!this.isOnChainEnabled()) {
      return false;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'paused',
        args: [],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to check paused status: ${error}`);
      return false;
    }
  }

  /**
   * Check if the relayer is authorized
   */
  async isRelayerAuthorized(): Promise<boolean> {
    if (!this.isOnChainEnabled() || !this.walletClient?.account) {
      return false;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.registryAddress,
        abi: PasskeyRegistryABI,
        functionName: 'authorizedRelayers',
        args: [this.walletClient.account.address],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to check relayer authorization: ${error}`);
      return false;
    }
  }
}
