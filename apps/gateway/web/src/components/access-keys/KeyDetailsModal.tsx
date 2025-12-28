import { useState, useEffect, type ReactElement } from 'react';
import { Key, Lock, Fingerprint, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAccessKeys, type AccessKeyWithMetadata } from '@/hooks/useAccessKeys';
import { useTokenList } from '@/hooks/useTokenList';
import { getKeyStatus, formatExpiry } from '@/lib/access-keys-utils';
import { copyToClipboard } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import type { Address } from 'viem';
import { formatUnits } from 'viem';

interface KeyDetailsModalProps {
  isOpen: boolean;
  accessKey: AccessKeyWithMetadata | null;
  onClose: () => void;
  onRevoke: () => void;
  onUpdateLimits: () => void;
}

export function KeyDetailsModal({
  isOpen,
  accessKey,
  onClose,
  onRevoke,
  onUpdateLimits,
}: KeyDetailsModalProps): ReactElement {
  const { getRemainingLimit } = useAccessKeys();
  const { tokens } = useTokenList();
  const [copied, setCopied] = useState(false);
  const [tokenLimits, setTokenLimits] = useState<
    Array<{ symbol: string; remaining: string; token: Address }>
  >([]);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);

  // Fetch remaining limits for each token
  useEffect(() => {
    if (!accessKey || !isOpen || !accessKey.enforceLimits) {
      setTokenLimits([]);
      return;
    }

    const fetchLimits = async (): Promise<void> => {
      setIsLoadingLimits(true);
      try {
        const limits = await Promise.all(
          tokens.slice(0, 5).map(async token => {
            const remaining = await getRemainingLimit(accessKey.keyId, token.address as Address);
            return {
              symbol: token.symbol,
              remaining: formatUnits(remaining, token.decimals),
              token: token.address as Address,
            };
          })
        );
        // Only show tokens with non-zero limits
        setTokenLimits(limits.filter(l => parseFloat(l.remaining) > 0));
      } catch (error) {
        console.error('Failed to fetch token limits:', error);
      } finally {
        setIsLoadingLimits(false);
      }
    };

    fetchLimits();
  }, [accessKey, tokens, getRemainingLimit, isOpen]);

  const handleCopy = async (): Promise<void> => {
    if (!accessKey) return;
    const success = await copyToClipboard(accessKey.keyId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  if (!accessKey) return <></>;

  const status = getKeyStatus(accessKey.isRevoked, accessKey.expiry);

  const getKeyTypeIcon = (): ReactElement => {
    switch (accessKey.signatureType) {
      case 'secp256k1':
        return <Key className="h-6 w-6 text-blue-600" />;
      case 'p256':
        return <Lock className="h-6 w-6 text-purple-600" />;
      case 'webAuthn':
        return <Fingerprint className="h-6 w-6 text-emerald-600" />;
      default:
        return <Key className="h-6 w-6 text-slate-600" />;
    }
  };

  const getStatusBadge = (): ReactElement => {
    switch (status) {
      case 'active':
        return (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
            Revoked
          </span>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {getKeyTypeIcon()}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                Access Key Details
                {getStatusBadge()}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground capitalize">
                {accessKey.signatureType} Key
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Key ID */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Key ID
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all">
                {accessKey.keyId}
              </div>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="h-10 w-10">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" asChild className="h-10 w-10">
                <a
                  href={getExplorerAddressUrl(accessKey.keyId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Details */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Key Type</span>
              <span className="text-xs font-medium text-foreground capitalize">
                {accessKey.signatureType}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Expiry</span>
              <span className="text-xs font-medium text-foreground">
                {formatExpiry(accessKey.expiry)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Enforce Limits</span>
              <span className="text-xs font-medium text-foreground">
                {accessKey.enforceLimits ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="text-xs font-medium text-foreground capitalize">{status}</span>
            </div>
          </div>

          {/* Spending Limits */}
          {accessKey.enforceLimits && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Remaining Spending Limits
              </label>
              {isLoadingLimits ? (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                  Loading limits...
                </div>
              ) : tokenLimits.length > 0 ? (
                <div className="bg-muted/50 rounded-lg divide-y divide-border">
                  {tokenLimits.map((limit, index) => (
                    <div key={index} className="flex items-center justify-between p-3">
                      <span className="text-xs text-muted-foreground">{limit.symbol}</span>
                      <span className="text-xs font-medium text-foreground font-mono">
                        {limit.remaining}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                  No spending limits configured
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {status === 'active' && (
              <>
                <Button variant="outline" className="flex-1" onClick={onUpdateLimits}>
                  Update Limits
                </Button>
                <Button variant="destructive" className="flex-1" onClick={onRevoke}>
                  Revoke Key
                </Button>
              </>
            )}
            {status !== 'active' && (
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
