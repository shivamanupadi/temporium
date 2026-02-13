import type { ReactElement } from 'react';
import type { Token } from '@/lib/tokenlist';
import { TokenPicker } from './TokenPicker';

export interface FeeTokenPickerProps {
  value: Token;
  tokens: Token[];
  onChange: (token: Token) => void;
}

export function FeeTokenPicker({ value, tokens, onChange }: FeeTokenPickerProps): ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F5F2ED]/60">
      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
        Fee Token
      </span>
      <TokenPicker token={value} tokens={tokens} onChange={onChange} />
    </div>
  );
}
