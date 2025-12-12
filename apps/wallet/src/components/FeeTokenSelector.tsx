import { useEffect, type ReactElement } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between gap-2 h-8 px-3 min-w-[100px] rounded-lg border border-border/50 bg-card text-[12px] font-medium hover:bg-muted/50 transition-colors"
          >
            <span>{value?.symbol || 'Select'}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {tokens.map(token => (
            <DropdownMenuItem
              key={token.address}
              onClick={() => onChange(token)}
              className="flex items-center justify-between text-[12px]"
            >
              <span>{token.symbol}</span>
              {value?.address === token.address && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
