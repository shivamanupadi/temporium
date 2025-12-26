/**
 * Generate a random nonce using Web Crypto API (Workers compatible)
 */
export function generateNonce(length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random challenge string
 */
export function generateChallenge(): string {
  return generateNonce(32);
}
