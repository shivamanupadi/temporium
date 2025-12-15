import { keccak256 } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import { Secp256k1 as TempoSecp256k1, P256 as TempoP256, WebAuthnP256 } from 'tempo.ts/viem';
import * as OxSecp256k1 from 'ox/Secp256k1';
import * as OxP256 from 'ox/P256';
import * as PublicKey from 'ox/PublicKey';
import type { Address, Hex } from 'viem';
import type { AccessKeyType } from '@/types';

/**
 * Generated Secp256k1 key pair
 */
export interface Secp256k1KeyPair {
  type: 'secp256k1';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

/**
 * Generated P256 key pair
 */
export interface P256KeyPair {
  type: 'p256';
  privateKey: Hex;
  publicKey: Hex;
  keyId: Address;
}

/**
 * Generated WebAuthn credential
 */
export interface WebAuthnCredential {
  type: 'webAuthn';
  credentialId: string;
  publicKey: Hex;
  keyId: Address;
  raw: unknown;
}

export type GeneratedKey = Secp256k1KeyPair | P256KeyPair | WebAuthnCredential;

/**
 * Generate a random Secp256k1 key pair
 * The keyId is derived as the Ethereum address from the public key
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
 * Generate a random P256 key pair
 * The keyId is derived by hashing the compressed public key
 */
export function generateP256Key(): P256KeyPair {
  const privateKey = TempoP256.randomPrivateKey();
  const publicKey = OxP256.getPublicKey({ privateKey });
  const publicKeyHex = PublicKey.toHex(publicKey);

  // Derive keyId from public key hash (take first 20 bytes)
  const hash = keccak256(publicKeyHex);
  const keyId = `0x${hash.slice(-40)}` as Address;

  return {
    type: 'p256',
    privateKey,
    publicKey: publicKeyHex,
    keyId,
  };
}

/**
 * Create a WebAuthn credential (passkey)
 * The keyId is derived from the credential's public key
 */
export async function generateWebAuthnKey(
  label: string,
  rpId?: string
): Promise<WebAuthnCredential> {
  const credential = await WebAuthnP256.createCredential({
    label,
    rpId: rpId ?? getRpId(),
  });

  // Derive keyId from public key hash (take first 20 bytes)
  const hash = keccak256(credential.publicKey as Hex);
  const keyId = `0x${hash.slice(-40)}` as Address;

  return {
    type: 'webAuthn',
    credentialId: credential.id,
    publicKey: credential.publicKey as Hex,
    keyId,
    raw: credential.raw,
  };
}

/**
 * Get the RP ID for WebAuthn credential creation
 * Matches the logic in wagmi.ts
 */
function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost';

  const hostname = window.location.hostname;

  // localhost or IP address - use as-is
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');

  // Handle special TLDs
  const specialSuffixes = ['pages.dev', 'workers.dev', 'co.uk', 'com.au', 'co.nz'];
  for (const suffix of specialSuffixes) {
    if (hostname.endsWith(`.${suffix}`)) {
      const suffixParts = suffix.split('.').length;
      return parts.slice(-(suffixParts + 1)).join('.');
    }
  }

  // Standard domain - return last 2 parts
  return parts.slice(-2).join('.');
}

/**
 * Get signature type number for on-chain usage
 */
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

/**
 * Get signature type label from on-chain number
 */
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

/**
 * Format expiry timestamp for display
 */
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

/**
 * Check if a key is expired
 */
export function isKeyExpired(expiry: number): boolean {
  if (expiry === 0) return false;
  return expiry * 1000 < Date.now();
}

/**
 * Get key status string
 */
export function getKeyStatus(isRevoked: boolean, expiry: number): 'active' | 'revoked' | 'expired' {
  if (isRevoked) return 'revoked';
  if (isKeyExpired(expiry)) return 'expired';
  return 'active';
}
