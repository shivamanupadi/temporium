import { createConfig, http } from 'wagmi';
import { webAuthn, KeyManager } from 'tempo.ts/wagmi';
import { tempoChain } from './tempo-client';
import { KEYS_API_URL } from './api';
import { saveAuthToken } from './auth-storage';

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

interface SerializedCredential {
  id: string;
  type: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    authenticatorData?: string;
    transports?: string[];
  };
  authenticatorAttachment?: string;
}

/**
 * Serialize WebAuthn credential for tempo.ts Handler.keyManager
 * Converts ArrayBuffers to base64 strings as expected by the server
 */
function serializeCredential(raw: PublicKeyCredential): SerializedCredential {
  const response = raw.response as AuthenticatorAttestationResponse;

  // Handler.keyManager expects authenticatorData directly on response
  // For AuthenticatorAttestationResponse, we need to call getAuthenticatorData()
  const authenticatorData = response.getAuthenticatorData ? response.getAuthenticatorData() : null;

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
 * Response from the keys API that includes JWT token
 */
interface KeysApiResponse {
  publicKey: `0x${string}`;
  accessToken?: string;
  expiresIn?: number;
}

/**
 * Custom KeyManager for HTTP-based storage with tempo.ts/server Handler.keyManager
 * Properly serializes WebAuthn credentials (converts ArrayBuffers to base64)
 * Also extracts and stores JWT token from the response
 */
const keyManager = KeyManager.from({
  async getChallenge() {
    const response = await fetch(`${KEYS_API_URL}/challenge`);
    if (!response.ok) throw new Error('Failed to get challenge');
    return response.json();
  },

  async getPublicKey(parameters) {
    console.log('[getPublicKey] Fetching:', `${KEYS_API_URL}/${parameters.credential.id}`);

    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`);
    console.log('[getPublicKey] Response status:', response.status);

    if (!response.ok) {
      throw new Error('publicKey not found.');
    }
    const data: KeysApiResponse = await response.json();
    console.log('[getPublicKey] Response data:', data);

    // Extract and store JWT token if present
    if (data.accessToken && data.expiresIn) {
      console.log('[getPublicKey] Saving auth token');
      saveAuthToken({
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
      });
    } else {
      console.warn('[getPublicKey] Response missing token');
    }

    return data.publicKey;
  },

  async setPublicKey(parameters) {
    // Serialize credential with ArrayBuffers converted to base64
    const serialized = serializeCredential(parameters.credential as unknown as PublicKeyCredential);

    console.log('[setPublicKey] Posting to:', `${KEYS_API_URL}/${parameters.credential.id}`);

    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: serialized,
        publicKey: parameters.publicKey,
      }),
    });

    console.log('[setPublicKey] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save public key: ${error}`);
    }

    // Extract and store JWT token from response
    const text = await response.text();
    console.log('[setPublicKey] Response body:', text);

    if (text) {
      const data: KeysApiResponse = JSON.parse(text);
      console.log('[setPublicKey] Parsed data:', data);

      if (data.accessToken && data.expiresIn) {
        console.log('[setPublicKey] Saving auth token');
        saveAuthToken({
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
        });
      } else {
        console.warn('[setPublicKey] Response missing token:', {
          hasAccessToken: !!data.accessToken,
          hasExpiresIn: !!data.expiresIn,
        });
      }
    } else {
      console.warn('[setPublicKey] Empty response body');
    }
  },
});

/**
 * Tempo passkey connector configuration
 * - rpId: Set to root domain to allow passkeys across subdomains
 * - keyManager: HTTP-backed storage in PostgreSQL (via NestJS API)
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
