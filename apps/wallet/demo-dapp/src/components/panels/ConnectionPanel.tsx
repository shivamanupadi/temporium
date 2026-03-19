import { type ReactElement, useState } from 'react';
import { Wifi, WifiOff, ShieldCheck, Activity } from 'lucide-react';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';

export function ConnectionPanel(): ReactElement {
  const { gateway, isConnected, address, chainId, connect, disconnect } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const exec = async (label: string, fn: () => Promise<unknown> | unknown) => {
    setLoading(label);
    setResult(null);
    try {
      const data = await fn();
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => exec('connect', connect)}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
        >
          <Wifi className="w-4 h-4" />
          {loading === 'connect' ? 'Connecting...' : 'Connect'}
        </button>

        <button
          onClick={() => exec('disconnect', () => { disconnect(); return { disconnected: true }; })}
          disabled={!isConnected || loading !== null}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#EDE9E3] text-[#6B6560] text-[13px] font-medium hover:bg-[#F5F2ED] transition-colors disabled:opacity-50"
        >
          <WifiOff className="w-4 h-4" />
          Disconnect
        </button>

        <button
          onClick={() => exec('verify', () => gateway.verifyConnection())}
          disabled={!isConnected || loading !== null}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#EDE9E3] text-[#6B6560] text-[13px] font-medium hover:bg-[#F5F2ED] transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          {loading === 'verify' ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#9B9590]" />
          <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Status</span>
        </div>
        <div className="space-y-2">
          <StatusRow label="Connected" value={String(isConnected)} highlight={isConnected} />
          <StatusRow label="Address" value={address || 'Not connected'} mono />
          <StatusRow label="Chain ID" value={chainId !== null ? String(chainId) : 'N/A'} />
          <StatusRow label="Verified" value={String(gateway.isConnectionVerified())} />
        </div>
      </div>

      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-3">Read Methods</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => exec('isConnected', () => ({ isConnected: gateway.isConnected() }))}
            className="px-3 py-2 rounded-lg border border-[#EDE9E3] text-[12px] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
          >
            isConnected()
          </button>
          <button
            onClick={() => exec('getAddress', () => ({ address: gateway.getAddress() }))}
            className="px-3 py-2 rounded-lg border border-[#EDE9E3] text-[12px] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
          >
            getAddress()
          </button>
          <button
            onClick={() => exec('getChainId', () => ({ chainId: gateway.getChainId() }))}
            className="px-3 py-2 rounded-lg border border-[#EDE9E3] text-[12px] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
          >
            getChainId()
          </button>
          <button
            onClick={() => exec('getConnectionStatus', () => gateway.getConnectionStatus())}
            className="px-3 py-2 rounded-lg border border-[#EDE9E3] text-[12px] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
          >
            getConnectionStatus()
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}

function StatusRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-[#9B9590]">{label}</span>
      <span
        className={`text-[12px] font-medium ${mono ? 'font-mono' : ''} ${
          highlight ? 'text-[#6B8F71]' : 'text-[#2D3436]'
        }`}
      >
        {mono && value.startsWith('0x') && value.length > 16
          ? `${value.slice(0, 8)}...${value.slice(-6)}`
          : value}
      </span>
    </div>
  );
}
