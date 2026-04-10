import { type ReactElement, useEffect, useRef, useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Remote, Messenger, Provider, webAuthn } from 'accounts';
import { Loader2, CheckCircle, XCircle, Fingerprint, X } from 'lucide-react';
import { tempoModerato, tempo } from 'viem/chains';
import { createCeremony } from '@/lib/ceremony';

export const Route = createFileRoute('/embed')({
  component: EmbedPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcRequest = any;

const REQUEST_LABELS: Record<string, string> = {
  wallet_connect: 'Connect Wallet',
  eth_requestAccounts: 'Connect Wallet',
  personal_sign: 'Sign Message',
  eth_sendTransaction: 'Send Transaction',
  eth_signTransaction: 'Sign Transaction',
  eth_signTypedData_v4: 'Sign Typed Data',
  wallet_sendCalls: 'Send Batch',
};

/**
 * Embed route for the accounts SDK Dialog adapter.
 *
 * Loaded inside a popup by dApps using @temporium/wallet-connect.
 * Uses accounts SDK Remote to receive RPC requests and shows
 * approval UI so the user can trigger passkey signing.
 */
function EmbedPage(): ReactElement {
  const remoteRef = useRef<ReturnType<typeof Remote.create> | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'idle' | 'pending' | 'signing' | 'success' | 'error'
  >('loading');
  const [pendingRequest, setPendingRequest] = useState<RpcRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const provider = Provider.create({
      adapter: webAuthn({ ceremony: createCeremony() }),
      chains: [tempoModerato, tempo] as any,
      persistCredentials: true,
    });

    const hostWindow = window.opener || window.parent;
    if (!hostWindow || hostWindow === window) {
      setStatus('idle');
      return;
    }

    const messenger = Messenger.bridge({
      from: Messenger.fromWindow(window),
      to: Messenger.fromWindow(hostWindow, { targetOrigin: '*' }),
    });

    const remote = Remote.create({ messenger, provider });
    remoteRef.current = remote;

    remote.onUserRequest(({ request }) => {
      if (!request) {
        setPendingRequest(null);
        setStatus('idle');
        return;
      }
      setPendingRequest(request);
      setStatus('pending');
    });

    remote.ready();
    setStatus('idle');

    return () => {
      remoteRef.current?.rejectAll();
    };
  }, []);

  const handleApprove = useCallback(async () => {
    const remote = remoteRef.current;
    if (!remote || !pendingRequest) return;

    setStatus('signing');
    try {
      await remote.respond(pendingRequest);
      setStatus('success');
      setPendingRequest(null);
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setStatus('error');
      setTimeout(() => {
        setError(null);
        setStatus('idle');
        setPendingRequest(null);
      }, 2500);
    }
  }, [pendingRequest]);

  const handleReject = useCallback(() => {
    const remote = remoteRef.current;
    if (!remote || !pendingRequest) return;
    remote.reject(pendingRequest);
    setPendingRequest(null);
    setStatus('idle');
  }, [pendingRequest]);

  return (
    <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
      <div className="w-full max-w-[320px] space-y-4">
        {status === 'loading' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#9B72CF] mx-auto" />
            <p className="text-sm text-[#8A8580] mt-3">Initializing...</p>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#E07A5F]/8 flex items-center justify-center mx-auto">
              <Fingerprint className="w-6 h-6 text-[#E07A5F]" />
            </div>
            <p className="text-sm font-medium text-[#2D3436] mt-3">Temporium Wallet</p>
            <p className="text-xs text-[#8A8580] mt-1">Waiting for request...</p>
          </div>
        )}

        {status === 'pending' && pendingRequest && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#E07A5F]/8 flex items-center justify-center mx-auto">
                <Fingerprint className="w-6 h-6 text-[#E07A5F]" />
              </div>
              <p className="text-sm font-medium text-[#2D3436] mt-3">
                {REQUEST_LABELS[pendingRequest.method] ?? pendingRequest.method}
              </p>
              <p className="text-xs text-[#8A8580] mt-1">Approve with your passkey</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#EDE9E3] text-[#6B6560] text-sm font-medium hover:bg-[#F5F2ED] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E07A5F] text-white text-sm font-medium hover:bg-[#D06A4F] transition-colors cursor-pointer"
              >
                <Fingerprint className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        )}

        {status === 'signing' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#E07A5F] mx-auto" />
            <p className="text-sm font-medium text-[#2D3436] mt-3">Approve in your wallet</p>
            <p className="text-xs text-[#8A8580] mt-1">Use your passkey to sign</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-[#5B9A6F]/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-5 h-5 text-[#5B9A6F]" />
            </div>
            <p className="text-sm text-[#5B9A6F] font-medium mt-3">Approved</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm text-red-600 font-medium mt-3">Failed</p>
            {error && <p className="text-xs text-[#8A8580] mt-1 max-w-[250px] mx-auto">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
