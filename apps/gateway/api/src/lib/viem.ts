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
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Tempo Testnet chain configuration
 */
export const tempoTestnet: Chain = {
  id: 42429,
  name: 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.tempo.xyz'] },
  },
};

/**
 * Create a public client for reading from blockchain (free)
 */
export function createTempoPublicClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: tempoTestnet,
    transport: http(rpcUrl),
  });
}

/**
 * Create a wallet client for writing to blockchain
 */
export function createTempoWalletClient(rpcUrl: string, privateKey: string): WalletClient {
  const account = privateKeyToAccount(privateKey as Hex);
  return createWalletClient({
    account,
    chain: tempoTestnet,
    transport: http(rpcUrl),
  });
}

/**
 * Hash a credentialId to bytes32 for contract storage
 */
export function hashCredentialId(credentialId: string): Hex {
  return keccak256(toBytes(credentialId));
}

/**
 * Normalize a P256 public key to 64 bytes (without 0x04 prefix)
 */
export function normalizePublicKey(publicKey: string): Hex {
  const hexPart = publicKey.slice(2); // Remove 0x prefix

  // If 130 chars (65 bytes with 0x04 prefix), strip the 04 prefix
  if (hexPart.length === 130 && hexPart.startsWith('04')) {
    return `0x${hexPart.slice(2)}` as Hex;
  }

  // If already 128 chars (64 bytes), return as-is
  if (hexPart.length === 128) {
    return publicKey as Hex;
  }

  throw new Error(`Invalid public key: expected 64 or 65 bytes, got ${hexPart.length / 2} bytes`);
}

/**
 * Validate and normalize public key format
 */
export function validateAndNormalizePublicKey(publicKey: string): Hex {
  if (!publicKey.startsWith('0x')) {
    throw new Error('Invalid public key: must start with 0x');
  }

  const hexPart = publicKey.slice(2);
  if (!/^[a-fA-F0-9]+$/.test(hexPart)) {
    throw new Error('Invalid public key: must be valid hexadecimal');
  }

  return normalizePublicKey(publicKey);
}

export type { Address, Hex, PublicClient, WalletClient };
