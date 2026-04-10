import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { webAuthn, dialog } from 'accounts/wagmi';
import { Dialog, WebAuthnCeremony } from 'accounts';
import { tempoChain } from './tempo-client';
import { KEYS_API_URL } from './api';
import { saveAuthToken } from './auth-storage';

/**
 * Custom WebAuthn ceremony that uses our /keys API (backed by on-chain PasskeyRegistry).
 *
 * Wraps WebAuthnCeremony.server() and intercepts responses to extract
 * JWT tokens injected by our onRegister/onAuthenticate hooks.
 */
const ceremony = (() => {
  const serverCeremony = WebAuthnCeremony.server({ url: KEYS_API_URL });

  return WebAuthnCeremony.from({
    async getRegistrationOptions(parameters) {
      return serverCeremony.getRegistrationOptions(parameters);
    },

    async verifyRegistration(credential) {
      const result = await serverCeremony.verifyRegistration(credential);

      // Extract JWT injected by the server's onRegister hook
      const data = result as Record<string, unknown>;
      if (data.accessToken && data.expiresIn) {
        saveAuthToken({
          accessToken: data.accessToken as string,
          expiresIn: data.expiresIn as number,
        });
      }

      return result;
    },

    async getAuthenticationOptions(parameters) {
      return serverCeremony.getAuthenticationOptions(parameters);
    },

    async verifyAuthentication(response) {
      const result = await serverCeremony.verifyAuthentication(response);

      // Extract JWT injected by the server's onAuthenticate hook
      const data = result as Record<string, unknown>;
      if (data.accessToken && data.expiresIn) {
        saveAuthToken({
          accessToken: data.accessToken as string,
          expiresIn: data.expiresIn as number,
        });
      }

      return result;
    },
  });
})();

export const tempoPasskeyConnector = webAuthn({
  ceremony,
});

export const injectedConnector = injected({
  shimDisconnect: true,
});

export const tempoWalletConnector = dialog({
  rdns: 'xyz.tempo.wallet',
  name: 'Tempo Wallet',
  dialog: Dialog.popup({ size: { width: 420, height: 600 } }),
});

export const wagmiConfig = createConfig({
  chains: [tempoChain] as const,
  connectors: [tempoPasskeyConnector, injectedConnector, tempoWalletConnector],
  transports: {
    [tempoChain.id]: http(tempoChain.rpcUrls.default.http[0]),
  } as Record<number, ReturnType<typeof http>>,
});
