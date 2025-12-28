import type React from 'react';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard, cn } from '@/lib/utils';
import { TIMING } from '@/lib/constants';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'default' | 'icon';
}

export function CopyButton({
  text,
  className,
  size = 'icon',
}: CopyButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  return (
    <Button variant="ghost" size={size} onClick={handleCopy} className={cn('h-8 w-8', className)}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
