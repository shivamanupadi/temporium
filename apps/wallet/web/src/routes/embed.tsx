import { type ReactElement, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Remote, Messenger, Provider, webAuthn, WebAuthnCeremony } from 'accounts';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { KEYS_API_URL } from '@/lib/api';
import { tempoChain } from '@/lib/tempo-client';
import { saveAuthToken } from '@/lib/auth-storage';

export const Route = createFileRoute('/embed')({
  component: EmbedPage,
});

/**
 * Embed route for the accounts SDK Dialog adapter.
 *
 * This page is loaded inside an iframe or popup by dApps using the
 * @temporium/wallet-connect SDK. It uses the accounts SDK Remote module
 * to receive RPC requests from the host and responds after the user
 * signs with their passkey.
 */
function EmbedPage(): ReactElement {
  const remoteRef = useRef<ReturnType<typeof Remote.create> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signing' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create WebAuthn ceremony pointing at our /keys API
    const serverCeremony = WebAuthnCeremony.server({ url: KEYS_API_URL });
    const ceremony = WebAuthnCeremony.from({
      async getRegistrationOptions(parameters) {
        return serverCeremony.getRegistrationOptions(parameters);
      },
      async verifyRegistration(credential) {
        const result = await serverCeremony.verifyRegistration(credential);
        const data = result as Record<string, unknown>;
        if (data.accessToken && data.expiresIn) {
          await saveAuthToken({
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
        const data = result as Record<string, unknown>;
        if (data.accessToken && data.expiresIn) {
          await saveAuthToken({
            accessToken: data.accessToken as string,
            expiresIn: data.expiresIn as number,
          });
        }
        return result;
      },
    });

    // Create a Provider with our webAuthn adapter
    const provider = Provider.create({
      adapter: webAuthn({ ceremony }),
      chains: [tempoChain] as any,
      persistCredentials: true,
    });

    // Create messenger bridge to communicate with the host (parent window or opener)
    const targetWindow = window.opener || window.parent;
    const messenger = Messenger.bridge({
      from: Messenger.fromWindow(window, { targetOrigin: '*' }),
      to: Messenger.fromWindow(targetWindow, { targetOrigin: '*' }),
    });

    // Create Remote
    const remote = Remote.create({ messenger, provider });
    remoteRef.current = remote;

    // Listen for user-facing requests
    remote.onUserRequest(async ({ request }) => {
      if (!request) {
        // Dialog closed
        return;
      }

      setStatus('signing');

      try {
        // Let the provider handle the request (triggers passkey signing)
        await remote.respond(request);
        setStatus('success');
        setTimeout(() => setStatus('ready'), 1500);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setError(message);
        setStatus('error');
        remote.reject(request);
        setTimeout(() => {
          setError(null);
          setStatus('ready');
        }, 2000);
      }
    });

    // Signal readiness to the host
    remote.ready();
    setStatus('ready');

    return () => {
      remote.rejectAll();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-[#9B72CF] mx-auto" />
            <p className="text-sm text-[#8A8580]">Initializing wallet...</p>
          </>
        )}
        {status === 'ready' && (
          <>
            <div className="w-10 h-10 rounded-full bg-[#5B9A6F]/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-5 h-5 text-[#5B9A6F]" />
            </div>
            <p className="text-sm text-[#8A8580]">Wallet ready</p>
          </>
        )}
        {status === 'signing' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-[#E07A5F] mx-auto" />
            <p className="text-sm text-[#2D3436] font-medium">Approve in your wallet</p>
            <p className="text-xs text-[#8A8580]">Use your passkey to sign</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-10 h-10 rounded-full bg-[#5B9A6F]/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-5 h-5 text-[#5B9A6F]" />
            </div>
            <p className="text-sm text-[#5B9A6F] font-medium">Approved</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm text-red-600 font-medium">Failed</p>
            {error && <p className="text-xs text-[#8A8580] max-w-[250px]">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
