import { type ReactElement } from 'react';
import { Menu, Wallet } from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress } from '@/lib/utils';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps): ReactElement {
  const { address } = useTempo();

  return (
    <header className="md:hidden sticky top-0 z-30 bg-[#FDFBF8]/80 backdrop-blur-xl border-b border-[#EDE9E3]">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Menu */}
        <button
          onClick={onMenuClick}
          className="p-2.5 -ml-2 rounded-lg text-[#6B6560] hover:text-[#2D3436] hover:bg-[#F5F2ED] transition-colors"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Temporium" className="w-5 h-5 rounded" />
          <span className="text-[15px] font-semibold text-[#2D3436] tracking-tight">Wallet</span>
        </div>

        {/* Wallet */}
        {address ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#EDE9E3]">
            <Wallet className="h-3.5 w-3.5 text-[#9B9590]" />
            <span className="font-mono text-[11px] font-medium text-[#6B6560]">
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
