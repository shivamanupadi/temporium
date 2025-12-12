import { createConfig, http } from 'wagmi';
import { webAuthn, KeyManager } from 'tempo.ts/wagmi';
import { tempoChain } from './tempo-client';

/**
 * Keys API URL - Cloudflare Worker endpoint
 * Set VITE_KEYS_API_URL in your environment or .env file
 * Example: https://tollr-keys.your-subdomain.workers.dev/keys
 */
const KEYS_API_URL = import.meta.env.VITE_KEYS_API_URL || 'http://localhost:8787/keys';

/**
 * Extract root domain from hostname for passkey rpId
 * This allows passkeys to work across subdomains (e.g., app.tollr.xyz, test.tollr.xyz)
 */
function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost';

  const hostname = window.location.hostname;

  // localhost or IP address - use as-is
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');

  // Handle special TLDs like .pages.dev, .workers.dev, .co.uk
  const specialSuffixes = ['pages.dev', 'workers.dev', 'co.uk', 'com.au', 'co.nz'];
  for (const suffix of specialSuffixes) {
    if (hostname.endsWith(`.${suffix}`)) {
      // Return subdomain + suffix (e.g., tollr.pages.dev)
      const suffixParts = suffix.split('.').length;
      return parts.slice(-(suffixParts + 1)).join('.');
    }
  }

  // Standard domain - return last 2 parts (e.g., tollr.xyz from app.tollr.xyz)
  return parts.slice(-2).join('.');
}

/**
 * Convert ArrayBuffer to base64 string (for JSON serialization)
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Serialize WebAuthn credential for tempo.ts Handler.keyManager
 * Converts ArrayBuffers to base64 strings as expected by the server
 */
function serializeCredential(raw: PublicKeyCredential) {
  const response = raw.response as AuthenticatorAttestationResponse;

  // Handler.keyManager expects authenticatorData directly on response
  // For AuthenticatorAttestationResponse, we need to call getAuthenticatorData()
  const authenticatorData = response.getAuthenticatorData
    ? response.getAuthenticatorData()
    : null;

  return {
    id: raw.id,
    type: raw.type,
    rawId: bufferToBase64(raw.rawId),
    response: {
      clientDataJSON: bufferToBase64(response.clientDataJSON),
      attestationObject: bufferToBase64(response.attestationObject),
      // Include authenticatorData for Handler.keyManager
      ...(authenticatorData && { authenticatorData: bufferToBase64(authenticatorData) }),
      ...(response.getTransports && { transports: response.getTransports() }),
    },
    ...(raw.authenticatorAttachment && {
      authenticatorAttachment: raw.authenticatorAttachment,
    }),
  };
}

/**
 * Custom KeyManager for HTTP-based storage with tempo.ts/server Handler.keyManager
 * Properly serializes WebAuthn credentials (converts ArrayBuffers to base64)
 */
const keyManager = KeyManager.from({
  async getChallenge() {
    const response = await fetch(`${KEYS_API_URL}/challenge`);
    if (!response.ok) throw new Error('Failed to get challenge');
    return response.json();
  },

  async getPublicKey(parameters) {
    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`);
    if (!response.ok) {
      throw new Error('publicKey not found.');
    }
    const data = await response.json();
    return data.publicKey;
  },

  async setPublicKey(parameters) {
    // Serialize credential with ArrayBuffers converted to base64
    const serialized = serializeCredential(parameters.credential as unknown as PublicKeyCredential);

    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: serialized,
        publicKey: parameters.publicKey,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save public key: ${error}`);
    }
  },
});

/**
 * Tempo passkey connector configuration
 * - rpId: Set to root domain to allow passkeys across subdomains
 * - keyManager: HTTP-backed storage in Cloudflare D1
 */
export const tempoPasskeyConnector = webAuthn({
  keyManager,
  rpId: getRpId(),
});

/**
 * Wagmi configuration for Tempo
 */
export const wagmiConfig = createConfig({
  chains: [tempoChain],
  connectors: [tempoPasskeyConnector],
  transports: {
    [tempoChain.id]: http(tempoChain.rpcUrls.default.http[0]),
  },
});
