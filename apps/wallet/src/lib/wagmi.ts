import { createConfig, http } from 'wagmi';
import { webAuthn, KeyManager } from 'tempo.ts/wagmi';
import { tempoChain } from './tempo-client';

/**
 * Key manager for storing passkey credentials
 * Uses localStorage for persistence
 */
const keyManager = KeyManager.localStorage();

/**
 * Tempo passkey connector configuration
 * Note: Label is passed dynamically via connect() capabilities
 */
export const tempoPasskeyConnector = webAuthn({
  keyManager,
  rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
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
