/**
 * Envelope encryption for access-key private keys at rest.
 *
 * KEK (key-encrypting key): 32 bytes, base64-encoded, lives in env.RECURRING_KEK.
 * DEK (data-encrypting key): freshly generated 32 bytes per record.
 *
 * Stored blob = { v, iv, dek, ct } where dek is the KEK-wrapped DEK and ct is
 * the DEK-encrypted plaintext (both AES-GCM, separate IVs).
 *
 * Stored exclusively in DurableObject storage (never D1) so each recurring
 * task's key material is isolated.
 */

import type { Env } from '../types/env';

export interface EncryptedKey {
  v: 1; // version tag for forward compat
  iv: string; // base64 — IV used for ct (12 bytes)
  dekIv: string; // base64 — IV used for wrapping the DEK (12 bytes)
  dek: string; // base64 — KEK-wrapped DEK ciphertext (includes GCM tag)
  ct: string; // base64 — DEK-encrypted plaintext (includes GCM tag)
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKek(env: Env): Promise<CryptoKey> {
  const raw = b64ToBytes(env.RECURRING_KEK);
  if (raw.length !== 32) {
    throw new Error('RECURRING_KEK must decode to 32 bytes (AES-256)');
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptAccessKey(privateKeyHex: string, env: Env): Promise<EncryptedKey> {
  const kek = await importKek(env);

  // Fresh random DEK per record
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));
  const dekKey = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dekIv = crypto.getRandomValues(new Uint8Array(12));

  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dekKey, enc.encode(privateKeyHex))
  );
  const wrappedDek = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, kek, dekRaw)
  );

  // Best-effort scrub
  dekRaw.fill(0);

  return {
    v: 1,
    iv: bytesToB64(iv),
    dekIv: bytesToB64(dekIv),
    dek: bytesToB64(wrappedDek),
    ct: bytesToB64(ct),
  };
}

export async function decryptAccessKey(blob: EncryptedKey, env: Env): Promise<string> {
  if (blob.v !== 1) throw new Error(`Unsupported encrypted-key version: ${blob.v}`);
  const kek = await importKek(env);

  const dekRaw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(blob.dekIv) },
      kek,
      b64ToBytes(blob.dek)
    )
  );
  const dekKey = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  dekRaw.fill(0);

  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(blob.iv) },
    dekKey,
    b64ToBytes(blob.ct)
  );
  return dec.decode(pt);
}
