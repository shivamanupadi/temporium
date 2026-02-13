import { type ReactElement, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Check } from 'lucide-react';
import type { Address } from 'viem';
import type { Token } from '@/lib/tokenlist';
import { getTokenColors } from '@/lib/tokenlist';
import { cn } from '@/lib/utils';

export interface TokenPickerProps {
  token: Token;
  tokens: Token[];
  disabledAddresses?: Address[];
  onChange: (token: Token) => void;
  accentColor?: string;
}

function TokenIcon({ token, size = 'sm' }: { token: Token; size?: 'sm' | 'xs' }): ReactElement {
  const colors = getTokenColors(token.symbol);
  const dims = size === 'sm' ? 'w-6 h-6' : 'w-5 h-5';
  const iconDims = size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5';

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

export function TokenPicker({
  token,
  tokens,
  disabledAddresses = [],
  onChange,
  accentColor = '#9B72CF',
}: TokenPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white border border-[#EDE9E3] hover:border-[#D5D0CA] transition-colors min-w-[130px]"
      >
        <TokenIcon token={token} size="sm" />
        <span className="text-[13px] font-semibold text-[#2D3436]">{token.symbol}</span>
        <svg className="w-3 h-3 ml-auto text-[#9B9590]" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border border-[#EDE9E3] bg-white shadow-lg shadow-black/[0.04] overflow-hidden"
          >
            {tokens.map(t => {
              const isDisabled = disabledAddresses.includes(t.address);
              const isActive = t.address === token.address;
              return (
                <button
                  key={t.address}
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                    isActive
                      ? 'font-semibold'
                      : isDisabled
                        ? 'opacity-40 cursor-not-allowed text-[#9B9590]'
                        : 'text-[#2D3436] hover:bg-[#F5F2ED]'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: `${accentColor}14`, color: accentColor }
                      : undefined
                  }
                >
                  <TokenIcon token={t} size="xs" />
                  <span>{t.symbol}</span>
                  {isActive && (
                    <Check className="w-3.5 h-3.5 ml-auto" style={{ color: accentColor }} />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
