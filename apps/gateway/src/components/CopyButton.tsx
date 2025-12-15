import { useState, useRef, useEffect, type ReactElement } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard, cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  className?: string;
  iconSize?: string;
}

export function CopyButton({
  value,
  className,
  iconSize = 'h-3.5 w-3.5',
}: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (): Promise<void> => {
    if (!value) return;
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors',
        className
      )}
    >
      {copied ? (
        <Check className={cn(iconSize, 'text-emerald-500')} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  );
}
