import { Account, Secp256k1 as TempoSecp256k1, P256 as TempoP256 } from 'viem/tempo';
import type { Address, Hex } from 'viem';
import type { AccessKeyType } from '@/types';

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
 * Uses viem/tempo Account.fromSecp256k1 for key derivation.
 */
export function generateSecp256k1Key(): Secp256k1KeyPair {
  const privateKey = TempoSecp256k1.randomPrivateKey();
  const account = Account.fromSecp256k1(privateKey);

  return {
    type: 'secp256k1',
    privateKey,
    publicKey: account.publicKey,
    keyId: account.address,
  };
}

/**
 * Generate a random P256 key pair.
 * Uses viem/tempo Account.fromP256 for key derivation.
 */
export function generateP256Key(): P256KeyPair {
  const privateKey = TempoP256.randomPrivateKey();
  const account = Account.fromP256(privateKey);

  return {
    type: 'p256',
    privateKey,
    publicKey: account.publicKey,
    keyId: account.address,
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
