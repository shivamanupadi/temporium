/**
 * Generate a random nonce key for Tempo's 2D nonce system.
 *
 * Each (nonceKey, nonce) pair is independent, so using a fresh random key
 * with nonce 0 places every transaction in its own lane — eliminating
 * cross-caller nonce conflicts when multiple workers share a relayer key.
 */
export function randomNonceKey(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return BigInt(
    '0x' +
      Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
  );
}
