import { keccak256 } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import { Secp256k1 as TempoSecp256k1, P256 as TempoP256 } from 'viem/tempo';
import * as OxSecp256k1 from 'ox/Secp256k1';
import * as OxP256 from 'ox/P256';
import * as PublicKey from 'ox/PublicKey';
import type { Address, Hex } from 'viem';
import type { AccessKeyType } from '@/types';

/**
 * Normalize a P256 public key to the format expected by the PasskeyRegistry contract.
 *
 * Expected format: 64 bytes (128 hex chars) without the 0x04 uncompressed prefix
 *
 * Input formats handled:
 * - 0x04... (65 bytes / 130 hex chars) - uncompressed with prefix -> strip prefix
 * - 0x... (64 bytes / 128 hex chars) - already normalized -> return as-is
 */
export function normalizeP256PublicKey(publicKey: Hex): Hex {
  const hexPart = publicKey.slice(2); // Remove 0x prefix

  // If 130 chars (65 bytes with 0x04 prefix), strip the 04 prefix
  if (hexPart.length === 130 && hexPart.startsWith('04')) {
    return `0x${hexPart.slice(2)}` as Hex;
  }

  // If already 128 chars (64 bytes), return as-is
  if (hexPart.length === 128) {
    return publicKey;
  }

  throw new Error(
    `Invalid P256 public key length: expected 64 or 65 bytes, got ${hexPart.length / 2} bytes`
  );
}

/**
 * Derive wallet address from a P256 public key.
 * Uses keccak256 hash and takes last 20 bytes - same as PasskeyRegistry contract.
 */
export function deriveWalletFromPublicKey(publicKey: Hex): Address {
  const normalized = normalizeP256PublicKey(publicKey);
  const hash = keccak256(normalized);
  return `0x${hash.slice(-40)}`.toLowerCase() as Address;
}

/** Generated Secp256k1 key pair */
export interface Secp256k1KeyPair {
  type: 'secp256k1';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

/** Generated P256 key pair */
export interface P256KeyPair {
  type: 'p256';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

export type GeneratedKey = Secp256k1KeyPair | P256KeyPair;

/**
 * Generate a random Secp256k1 key pair.
 * The keyId is derived as the Ethereum address from the public key.
 */
export function generateSecp256k1Key(): Secp256k1KeyPair {
  const privateKey = TempoSecp256k1.randomPrivateKey();
  const publicKey = OxSecp256k1.getPublicKey({ privateKey });
  const keyId = privateKeyToAddress(privateKey);
  const publicKeyHex = PublicKey.toHex(publicKey);

  return {
    type: 'secp256k1',
    privateKey,
    publicKey: publicKeyHex,
    keyId,
  };
}

/**
 * Generate a random P256 key pair.
 * The keyId is derived by hashing the normalized public key (64 bytes without 0x04 prefix).
 */
export function generateP256Key(): P256KeyPair {
  const privateKey = TempoP256.randomPrivateKey();
  const publicKey = OxP256.getPublicKey({ privateKey });
  const publicKeyHex = PublicKey.toHex(publicKey);

  const normalizedPublicKey = normalizeP256PublicKey(publicKeyHex);
  const keyId = deriveWalletFromPublicKey(normalizedPublicKey);

  return {
    type: 'p256',
    privateKey,
    publicKey: normalizedPublicKey,
    keyId,
  };
}

/** Get signature type number for on-chain usage */
export function getSignatureTypeNumber(type: AccessKeyType): number {
  switch (type) {
    case 'secp256k1':
      return 0;
    case 'p256':
      return 1;
    case 'webAuthn':
      return 2;
    default:
      throw new Error(`Unknown key type: ${type}`);
  }
}

/** Get signature type label from on-chain number */
export function getSignatureTypeLabel(typeNumber: number): AccessKeyType {
  switch (typeNumber) {
    case 0:
      return 'secp256k1';
    case 1:
      return 'p256';
    case 2:
      return 'webAuthn';
    default:
      throw new Error(`Unknown signature type number: ${typeNumber}`);
  }
}

/** Format expiry timestamp for display */
export function formatExpiry(expiry: number): string {
  if (expiry === 0) return 'Never';

  const date = new Date(expiry * 1000);
  const now = Date.now();

  if (expiry * 1000 < now) {
    return 'Expired';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Check if a key is expired */
export function isKeyExpired(expiry: number): boolean {
  if (expiry === 0) return false;
  return expiry * 1000 < Date.now();
}

/** Get key status string */
export function getKeyStatus(isRevoked: boolean, expiry: number): 'active' | 'revoked' | 'expired' {
  if (isRevoked) return 'revoked';
  if (isKeyExpired(expiry)) return 'expired';
  return 'active';
}
