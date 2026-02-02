import { type ReactElement } from 'react';
import { Menu, Wallet, Zap } from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress } from '@/lib/utils';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps): ReactElement {
  const { address } = useTempo();

  return (
    <header className="md:hidden sticky top-0 z-30 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-[#F0F0F0]">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Menu */}
        <button
          onClick={onMenuClick}
          className="p-2.5 -ml-2 rounded-lg text-[#52525B] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-colors"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-slate-900" strokeWidth={2} />
          <span className="text-[15px] font-semibold text-slate-900 tracking-tight">Wallet</span>
        </div>

        {/* Wallet */}
        {address ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#E4E4E7]">
            <Wallet className="h-3.5 w-3.5 text-[#A1A1AA]" />
            <span className="font-mono text-[11px] font-medium text-[#52525B]">
              {formatAddress(address, 3)}
            </span>
          </div>
        ) : (
          <div className="w-[88px]" />
        )}
      </div>
    </header>
  );
}
