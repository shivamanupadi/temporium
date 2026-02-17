import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { webAuthn, KeyManager } from 'wagmi/tempo';
import { tempoChain } from './tempo-client';
import { TEMPO_NETWORK } from './api';
import { saveAuthToken } from './auth-storage';

// Use wallet API for passkey management — single passkey system across all dapps
const WALLET_API_URL = import.meta.env.VITE_WALLET_API_URL || 'http://localhost:4008';
const KEYS_API_URL = `${WALLET_API_URL}/keys`;

function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
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

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function serializeCredential(raw: PublicKeyCredential) {
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
    ...(raw.authenticatorAttachment && { authenticatorAttachment: raw.authenticatorAttachment }),
  };
}

interface KeysApiResponse {
  publicKey: `0x${string}`;
  accessToken?: string;
  expiresIn?: number;
}

const keyManager = KeyManager.from({
  async getChallenge() {
    const response = await fetch(`${KEYS_API_URL}/challenge`, {
      headers: { 'X-Tempo-Network': TEMPO_NETWORK },
    });
    if (!response.ok) throw new Error('Failed to get challenge');
    return response.json();
  },

  async getPublicKey(parameters) {
    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`, {
      headers: { 'X-Tempo-Network': TEMPO_NETWORK },
    });
    if (!response.ok) throw new Error('publicKey not found.');
    const data: KeysApiResponse = await response.json();
    if (data.accessToken && data.expiresIn) {
      saveAuthToken({ accessToken: data.accessToken, expiresIn: data.expiresIn });
    }
    return data.publicKey;
  },

  async setPublicKey(parameters) {
    const serialized = serializeCredential(parameters.credential as unknown as PublicKeyCredential);
    const response = await fetch(`${KEYS_API_URL}/${parameters.credential.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tempo-Network': TEMPO_NETWORK },
      body: JSON.stringify({ credential: serialized, publicKey: parameters.publicKey }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save public key: ${error}`);
    }
    const text = await response.text();
    if (text) {
      const data: KeysApiResponse = JSON.parse(text);
      if (data.accessToken && data.expiresIn) {
        saveAuthToken({ accessToken: data.accessToken, expiresIn: data.expiresIn });
      }
    }
  },
});

export const tempoPasskeyConnector = webAuthn({
  keyManager,
  rpId: getRpId(),
});

export const injectedConnector = injected({
  shimDisconnect: true,
});

export const wagmiConfig = createConfig({
  chains: [tempoChain] as const,
  connectors: [tempoPasskeyConnector, injectedConnector],
  transports: {
    [tempoChain.id]: http(tempoChain.rpcUrls.default.http[0]),
  } as Record<number, ReturnType<typeof http>>,
});
