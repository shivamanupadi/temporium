import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { webAuthn, KeyManager } from 'wagmi/tempo';
import { tempoChain } from './tempo-client';

/**
 * Wallet API base URL from environment
 */
const WALLET_API_URL = import.meta.env.VITE_WALLET_API_URL || 'https://wallet-api.temporium.xyz';

/**
 * Keys API URL for passkey storage
 */
const KEYS_API_URL = `${WALLET_API_URL}/keys`;

/**
 * Extract root domain from hostname for passkey rpId
 */
function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost';

  const hostname = window.location.hostname;

  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');
  const specialSuffixes = ['pages.dev', 'workers.dev', 'co.uk', 'com.au', 'co.nz'];

  for (const suffix of specialSuffixes) {
    if (hostname.endsWith(`.${suffix}`)) {
      const suffixParts = suffix.split('.').length;
      return parts.slice(-(suffixParts + 1)).join('.');
    }
  }

  return parts.slice(-2).join('.');
}

/**
 * Convert ArrayBuffer to base64 string
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
 * Serialize WebAuthn credential for storage
 */
function serializeCredential(raw: PublicKeyCredential): SerializedCredential {
  const response = raw.response as AuthenticatorAttestationResponse;
  const authenticatorData = response.getAuthenticatorData ? response.getAuthenticatorData() : null;

  return {
    id: raw.id,
    type: raw.type,
    rawId: bufferToBase64(raw.rawId),
    response: {
      clientDataJSON: bufferToBase64(response.clientDataJSON),
      attestationObject: bufferToBase64(response.attestationObject),
      ...(authenticatorData && { authenticatorData: bufferToBase64(authenticatorData) }),
      ...(response.getTransports && { transports: response.getTransports() }),
    },
    ...(raw.authenticatorAttachment && {
      authenticatorAttachment: raw.authenticatorAttachment,
    }),
  };
}

/**
 * Key manager for HTTP-based passkey storage
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
 * Tempo passkey connector
 */
export const tempoPasskeyConnector = webAuthn({
  keyManager,
  rpId: getRpId(),
});

/**
 * Injected wallet connector (MetaMask, etc.)
 */
export const injectedConnector = injected({
  shimDisconnect: true,
});

/**
 * Wagmi configuration for Tempo
 */
export const wagmiConfig = createConfig({
  chains: [tempoChain],
  connectors: [tempoPasskeyConnector, injectedConnector],
  transports: {
    [tempoChain.id]: http(tempoChain.rpcUrls.default.http[0]),
  },
});
