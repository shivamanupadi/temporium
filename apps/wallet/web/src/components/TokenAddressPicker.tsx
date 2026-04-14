import { type ReactElement, useState, useCallback, useEffect, useRef } from 'react';
import { Coins, ChevronDown, AlertTriangle, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTokenList } from '@/hooks/useTokenList';
import { getTokenColors, type Token } from '@/lib/tokenlist';
import { formatAddress, isValidAddress, cn } from '@/lib/utils';

export interface TokenAddressPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showValidation?: boolean;
}

function TokenIcon({ token }: { token: Token }): ReactElement {
  const colors = getTokenColors(token.symbol);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="w-7 h-7 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn('h-3 w-3', token.logoURI && 'hidden')}
        style={{ color: colors.text }}
      />
    </div>
  );
}

export function TokenAddressPicker({
  value,
  onChange,
  label = 'Token Address',
  placeholder = '0x...',
  showValidation = true,
}: TokenAddressPickerProps): ReactElement {
  const [showTokens, setShowTokens] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { tokens, isLoading: tokensLoading } = useTokenList();

  const isInvalid = showValidation && value && !isValidAddress(value);

  // Close on outside click
  useEffect(() => {
    if (!showTokens) return;
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTokens(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTokens]);

  const selectToken = useCallback(
    (token: Token) => {
      onChange(token.address);
      setShowTokens(false);
    },
    [onChange]
  );

  const matchedToken = tokens.find(t => t.address.toLowerCase() === value.toLowerCase());

  return (
    <div ref={containerRef}>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
          {label}
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTokens(!showTokens)}
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium transition-colors px-2.5 py-1 rounded-lg',
              showTokens
                ? 'text-[#2D3436] bg-[#EDE9E3]'
                : 'text-[#9B9590] bg-[#F5F2ED] hover:bg-[#EDE9E3] hover:text-[#6B6560]'
            )}
          >
            <Coins className="h-3 w-3" />
            Tokens
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                showTokens && 'rotate-180'
              )}
            />
          </button>

          {showTokens && (
            <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-[#EDE9E3] bg-white z-50 overflow-hidden shadow-lg shadow-black/[0.06]">
              <div className="max-h-[220px] overflow-y-auto py-1">
                {tokensLoading ? (
                  <div className="px-4 py-4 text-[12px] text-[#9B9590] text-center">Loading...</div>
                ) : tokens.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2">
                      <Coins className="w-3.5 h-3.5 text-[#B5B0AA]" />
                    </div>
                    <p className="text-[12px] text-[#9B9590]">No tokens found</p>
                  </div>
                ) : (
                  tokens.map(token => {
                    const isSelected = token.address.toLowerCase() === value.toLowerCase();
                    return (
                      <button
                        key={token.address}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          selectToken(token);
                        }}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                          isSelected ? 'bg-[#F5F2ED]' : 'hover:bg-[#FDFBF8]'
                        )}
                      >
                        <TokenIcon token={token} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#2D3436] truncate">
                            {token.symbol}
                          </p>
                          <p className="text-[10px] text-[#B5B0AA] font-mono truncate">
                            {formatAddress(token.address, 6)}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2D3436] shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address input */}
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value.trim())}
        className={cn(
          'text-[14px] font-mono px-4 bg-[#FDFBF8]',
          isInvalid && 'border-red-300 bg-red-50/30'
        )}
      />

      {/* Matched token label */}
      {matchedToken && (
        <p className="text-[11px] font-medium text-[#9B9590] mt-1.5">
          Matched <span className="text-[#2D3436]">{matchedToken.symbol}</span> -{' '}
          {matchedToken.name}
        </p>
      )}

      {/* Validation error */}
      {isInvalid && (
        <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid address format
        </p>
      )}
    </div>
  );
}
