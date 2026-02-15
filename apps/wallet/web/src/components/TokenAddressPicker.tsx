import {
  type ReactElement,
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { Coins, ChevronDown, AlertTriangle, DollarSign } from 'lucide-react';
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

function TokenIcon({ token, size = 'sm' }: { token: Token; size?: 'sm' | 'xs' }): ReactElement {
  const colors = getTokenColors(token.symbol);
  const dims = size === 'sm' ? 'w-8 h-8' : 'w-6 h-6';
  const iconDims = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <div
      className={cn(dims, 'rounded-full flex items-center justify-center overflow-hidden shrink-0')}
      style={{ backgroundColor: colors.bg }}
    >
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className={cn(dims, 'rounded-full object-cover')}
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn(iconDims, token.logoURI && 'hidden')}
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
  const { tokens, isLoading: tokensLoading } = useTokenList();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const isInvalid = showValidation && value && !isValidAddress(value);

  const toggleDropdown = useCallback(() => {
    setShowTokens(prev => !prev);
  }, []);

  // Position the portal dropdown relative to the trigger button
  useLayoutEffect(() => {
    if (!showTokens || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [showTokens]);

  // Close on outside click
  useEffect(() => {
    if (!showTokens) return;
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setShowTokens(false);
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

  // Find matching token for current value
  const matchedToken = tokens.find(t => t.address.toLowerCase() === value.toLowerCase());

  return (
    <div>
      {/* Label row with Tokens toggle */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
          {label}
        </label>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleDropdown}
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer',
            showTokens ? 'text-lavender' : 'text-[#9B9590] hover:text-[#6B6560]'
          )}
        >
          <Coins className="h-3 w-3" />
          Tokens
          <ChevronDown className={cn('h-3 w-3 transition-transform', showTokens && 'rotate-180')} />
        </button>

        {/* Tokens dropdown — portaled to body to avoid overflow clipping */}
        {showTokens &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed w-64 rounded-xl border border-[#EDE9E3] bg-white overflow-hidden shadow-lg shadow-black/[0.06]"
              style={{ top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
            >
              <div className="max-h-[220px] overflow-y-auto">
                {tokensLoading ? (
                  <div className="px-4 py-3 text-[12px] text-[#9B9590]">Loading tokens...</div>
                ) : tokens.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="w-9 h-9 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2">
                      <Coins className="w-4 h-4 text-[#B5B0AA]" />
                    </div>
                    <p className="text-[12px] text-[#9B9590]">No tokens found</p>
                  </div>
                ) : (
                  tokens.map((token, index) => {
                    const isSelected = token.address.toLowerCase() === value.toLowerCase();
                    const isLast = index === tokens.length - 1;
                    return (
                      <button
                        key={token.address}
                        type="button"
                        onClick={() => selectToken(token)}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors cursor-pointer',
                          isSelected ? 'bg-lavender/5' : 'hover:bg-[#F5F2ED]',
                          !isLast && 'border-b border-[#EDE9E3]/40'
                        )}
                      >
                        <TokenIcon token={token} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#2D3436] truncate">
                            {token.symbol}
                            <span className="font-normal text-[#9B9590] ml-1.5">{token.name}</span>
                          </p>
                          <p className="text-[11px] text-[#9B9590] font-mono truncate">
                            {formatAddress(token.address, 6)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Address input */}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value.trim())}
          className={cn(
            'w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors',
            isInvalid && 'border-coral/50 bg-coral/[0.03]'
          )}
        />
        {matchedToken && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-lavender bg-lavender/8 px-2 py-0.5 rounded-full">
            {matchedToken.symbol}
          </span>
        )}
      </div>

      {/* Validation error */}
      {isInvalid && (
        <p className="text-[11px] text-coral mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid address format
        </p>
      )}
    </div>
  );
}
