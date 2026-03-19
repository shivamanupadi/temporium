import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, DollarSign } from 'lucide-react';
import type { Token } from '@/lib/tokenlist';
import { getTokenColors } from '@/lib/tokenlist';
import { cn } from '@/lib/utils';

export interface FeeTokenPickerProps {
  value: Token;
  tokens: Token[];
  onChange: (token: Token) => void;
}

function SmallTokenIcon({ token }: { token: Token }): ReactElement {
  const colors = getTokenColors(token.symbol);
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="w-5 h-5 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn('h-2.5 w-2.5', token.logoURI && 'hidden')}
        style={{ color: colors.text }}
      />
    </div>
  );
}

export function FeeTokenPicker({ value, tokens, onChange }: FeeTokenPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const justClosedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(() => {
    // Prevent reopening when a selection just closed the dropdown
    if (justClosedRef.current) {
      justClosedRef.current = false;
      return;
    }
    setOpen(prev => !prev);
  }, []);

  const handleSelect = useCallback(
    (token: Token) => {
      onChange(token);
      setOpen(false);
      justClosedRef.current = true;
      requestAnimationFrame(() => {
        justClosedRef.current = false;
      });
    },
    [onChange]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-full border transition-colors text-[12px] font-medium',
          open
            ? 'border-[#D5D0C9] bg-[#F5F2ED] text-[#2D3436]'
            : 'border-[#EDE9E3] bg-white text-[#6B6560] hover:border-[#D5D0C9]'
        )}
      >
        <SmallTokenIcon token={value} />
        {value.symbol}
        <ChevronDown
          className={cn(
            'w-3 h-3 text-[#B5B0AA] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl border border-[#EDE9E3] bg-white z-[9999] overflow-hidden shadow-lg shadow-black/[0.06]">
          <div className="max-h-[180px] overflow-y-auto py-1">
            {tokens.map(token => {
              const isSelected = token.address.toLowerCase() === value.address.toLowerCase();
              return (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handleSelect(token)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-[#F5F2ED]' : 'hover:bg-[#FDFBF8]'
                  )}
                >
                  <SmallTokenIcon token={token} />
                  <span className="text-[12px] font-medium text-[#2D3436] flex-1">
                    {token.symbol}
                  </span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#2D3436]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
