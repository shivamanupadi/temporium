import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CircleDollarSign, ChevronRight } from 'lucide-react';
import { formatAmount, formatAddress } from '@/lib/utils';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';

interface StablecoinCardProps {
  coin: StablecoinWithMetadata;
}

export function StablecoinCard({ coin }: StablecoinCardProps): ReactElement {
  const navigate = useNavigate();

  const handleClick = (): void => {
    navigate({ to: '/portal/stablecoins/$address', params: { address: coin.address } });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium text-foreground">{coin.name}</p>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {coin.symbol}
              </span>
              {coin.metadata?.paused && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  Paused
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {formatAddress(coin.address, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Balance */}
          <div className="text-right">
            <p className="text-[14px] font-medium text-foreground tabular-nums">
              {coin.userBalance !== undefined
                ? formatAmount(coin.userBalance.toString(), coin.metadata?.decimals ?? 6)
                : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">{coin.symbol}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
