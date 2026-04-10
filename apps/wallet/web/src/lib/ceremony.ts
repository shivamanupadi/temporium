import { WebAuthnCeremony } from 'accounts';
import { KEYS_API_URL } from './api';
import { saveAuthToken } from './auth-storage';

/**
 * Create a WebAuthn ceremony backed by our /keys API (on-chain PasskeyRegistry).
 *
 * Wraps WebAuthnCeremony.server() to intercept verify responses and
 * extract JWT tokens injected by the server's onRegister/onAuthenticate hooks.
 */
export function createCeremony(): ReturnType<typeof WebAuthnCeremony.from> {
  const server = WebAuthnCeremony.server({ url: KEYS_API_URL });

  return WebAuthnCeremony.from({
    getRegistrationOptions: params => server.getRegistrationOptions(params),
    getAuthenticationOptions: params => server.getAuthenticationOptions(params),

    async verifyRegistration(credential) {
      const result = await server.verifyRegistration(credential);
      extractToken(result);
      return result;
    },

    async verifyAuthentication(response) {
      const result = await server.verifyAuthentication(response);
      extractToken(result);
      return result;
    },
  });
}

function extractToken(result: unknown): void {
  const data = result as Record<string, unknown>;
  if (data.accessToken && data.expiresIn) {
    void saveAuthToken({
      accessToken: data.accessToken as string,
      expiresIn: data.expiresIn as number,
    });
  }
}
