import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CircleDollarSign, ChevronRight } from 'lucide-react';
import { formatAmount, formatAddress } from '@/lib/utils';
import type { StablecoinWithMetadata } from '@/types';

interface StablecoinCardProps {
  coin: StablecoinWithMetadata;
}

export function StablecoinCard({ coin }: StablecoinCardProps): ReactElement {
  const navigate = useNavigate();

  const handleClick = (): void => {
    navigate({ to: '/portal/tip20-studio/$address', params: { address: coin.address } });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full px-6 py-4 text-left hover:bg-[#FDFBF8] transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-coral/8 flex items-center justify-center shrink-0">
            <CircleDollarSign className="h-5 w-5 text-coral" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-[#2D3436]">{coin.name}</p>
              <span className="text-[11px] font-medium text-[#6B6560] bg-[#F5F2ED] px-1.5 py-0.5 rounded">
                {coin.symbol}
              </span>
              {coin.metadata?.paused && (
                <span className="text-[10px] font-medium text-[#D4A574] bg-[#D4A574]/10 px-1.5 py-0.5 rounded">
                  Paused
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#9B9590] font-mono mt-0.5">
              {formatAddress(coin.address, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[14px] font-semibold text-[#2D3436] tabular-nums">
              {coin.userBalance !== undefined
                ? formatAmount(coin.userBalance.toString(), coin.metadata?.decimals ?? 6)
                : '\u2014'}
            </p>
            <p className="text-[11px] text-[#9B9590]">{coin.symbol}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#B5B0AA]" />
        </div>
      </div>
    </button>
  );
}
