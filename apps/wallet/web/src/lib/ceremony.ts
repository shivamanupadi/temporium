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
      await extractToken(result);
      return result;
    },

    async verifyAuthentication(response) {
      const result = await server.verifyAuthentication(response);
      await extractToken(result);
      return result;
    },
  });
}

/**
 * Persist the JWT injected by the server's onRegister/onAuthenticate hooks.
 *
 * IMPORTANT: this must be awaited. If we let saveAuthToken run as a
 * fire-and-forget promise (the previous `void saveAuthToken(...)` form),
 * the WebAuthn ceremony resolves and the wagmi connector reports the
 * passkey as "connected" before the token actually lands in IDB /
 * localStorage. The portal route guard (`isAccessTokenExpired`) then
 * reads no token on first navigation and bounces the user back to /,
 * which presents as "auto-logout right after sign-in". Awaiting the
 * write closes that race.
 */
async function extractToken(result: unknown): Promise<void> {
  const data = result as Record<string, unknown>;
  if (data.accessToken && data.expiresIn) {
    await saveAuthToken({
      accessToken: data.accessToken as string,
      expiresIn: data.expiresIn as number,
    });
  }
}
