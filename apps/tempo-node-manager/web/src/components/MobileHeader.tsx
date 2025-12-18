import { type ReactElement } from 'react';
import { Menu, Zap } from 'lucide-react';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps): ReactElement {
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
          <span className="text-[15px] font-semibold text-slate-900 tracking-tight">Temporium</span>
        </div>

        {/* Spacer for balance */}
        <div className="w-[42px]" />
      </div>
    </header>
  );
}
