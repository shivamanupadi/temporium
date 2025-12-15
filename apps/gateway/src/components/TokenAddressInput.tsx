import { useState, type ReactElement } from 'react';
import { CircleDollarSign, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStablecoins } from '@/hooks/useStablecoins';
import { cn, isValidAddress } from '@/lib/utils';

interface TokenAddressInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showValidation?: boolean;
  className?: string;
}

export function TokenAddressInput({
  label,
  value,
  onChange,
  placeholder = '0x...',
  showValidation = true,
  className,
}: TokenAddressInputProps): ReactElement {
  const { stablecoins } = useStablecoins();
  const [showTokens, setShowTokens] = useState(false);

  const hasTokens = stablecoins.length > 0;
  const isInvalid = showValidation && value && !isValidAddress(value);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {hasTokens && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTokens(!showTokens)}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <CircleDollarSign className="h-3 w-3" />
              TIP20 Studio
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', showTokens && 'rotate-180')}
              />
            </button>
            {showTokens && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTokens(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-white z-20 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {stablecoins.map(coin => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => {
                          onChange(coin.address);
                          setShowTokens(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">
                            {coin.name} ({coin.symbol})
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {coin.address.slice(0, 10)}...{coin.address.slice(-6)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 font-mono text-[13px]"
      />
      {isInvalid && <p className="text-[11px] text-destructive mt-1.5">Invalid address</p>}
    </div>
  );
}
