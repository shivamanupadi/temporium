import { type ReactElement } from 'react';
import { Wifi, WifiOff, Zap } from 'lucide-react';
import { useGateway } from '@/hooks/useGateway';
import { formatAddress } from '@/lib/utils';

export function Header(): ReactElement {
  const { isConnected, address, chainId, connect, disconnect } = useGateway();

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-[#EDE9E3]">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#E07A5F]" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-[#2D3436]">Gateway Test dApp</h1>
            <p className="text-[11px] text-[#9B9590]">@temporium/wallet-connect</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && address ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6B8F71]/8 border border-[#6B8F71]/15">
                <div className="w-2 h-2 rounded-full bg-[#6B8F71]" />
                <span className="text-[12px] font-mono text-[#6B8F71] font-medium">
                  {formatAddress(address, 4)}
                </span>
                {chainId && (
                  <span className="text-[10px] text-[#6B8F71]/60">#{chainId}</span>
                )}
              </div>
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE9E3] text-[12px] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
              >
                <WifiOff className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[13px] font-semibold transition-colors"
            >
              <Wifi className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
