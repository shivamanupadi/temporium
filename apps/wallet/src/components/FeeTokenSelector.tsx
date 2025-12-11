import { useEffect, type ReactElement } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTokenList } from '@/hooks/useTokenList';
import { cn } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';

interface FeeTokenSelectorProps {
  value: Token | null | undefined;
  onChange: (token: Token) => void;
  className?: string;
}

export function FeeTokenSelector({
  value,
  onChange,
  className,
}: FeeTokenSelectorProps): ReactElement {
  const { tokens } = useTokenList();

  // Set default fee token when tokens load
  useEffect(() => {
    if (tokens.length > 0 && !value) {
      const defaultToken = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0];
      onChange(defaultToken);
    }
  }, [tokens, value, onChange]);

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-[12px] text-muted-foreground">Pay fee with</span>
      <Select
        value={value?.address}
        onValueChange={address => {
          const token = tokens.find(t => t.address === address);
          if (token) onChange(token);
        }}
      >
        <SelectTrigger className="w-auto h-8 min-w-[100px] text-[12px]">
          <SelectValue placeholder="Select token" />
        </SelectTrigger>
        <SelectContent>
          {tokens.map(token => (
            <SelectItem key={token.address} value={token.address}>
              {token.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
