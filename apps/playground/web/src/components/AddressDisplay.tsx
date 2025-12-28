import type React from 'react';
import { formatAddress, cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { ExternalLink } from 'lucide-react';

interface AddressDisplayProps {
  address: string;
  chars?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  chars = 4,
  showCopy = true,
  showExplorer = false,
  className,
}: AddressDisplayProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="font-mono text-sm">{formatAddress(address, chars)}</span>
      {showCopy && <CopyButton text={address} />}
      {showExplorer && (
        <a
          href={getExplorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
