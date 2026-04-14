import { type ReactElement, useState, useCallback, useEffect } from 'react';
import { Shield, AlertCircle, Loader2, Trash2, DollarSign } from 'lucide-react';
import { toast } from '@/lib/toast';
import { isAddress, formatUnits, type Address } from 'viem';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAddress, cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenAddressPicker } from '@/components/TokenAddressPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getTokenColors, type Token } from '@/lib/tokenlist';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { tempoChain } from '@/lib/tempo-client';
import type { TokenMetadata } from '@/types';

interface SpendingLimitsModalProps {
  keyId: string;
  isOpen: boolean;
  onClose: () => void;
  enforceLimits: boolean;
  updateSpendingLimit: (params: {
    keyId: Address;
    token: Address;
    newLimit: bigint;
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;
  getRemainingLimit: (
    keyId: Address,
    token: Address
  ) => Promise<{ remaining: bigint; periodEnd: bigint } | null>;
  onUpdated: () => Promise<void>;
}

interface LookupState {
  token: Address;
  metadata: TokenMetadata;
  remaining: bigint | null; // null = no limit configured
}

function TokenIcon({ symbol, logoURI }: { symbol: string; logoURI?: string }): ReactElement {
  const colors = getTokenColors(symbol);
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {logoURI ? (
        <img
          src={logoURI}
          alt={symbol}
          className="w-9 h-9 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign className={cn('h-4 w-4', logoURI && 'hidden')} style={{ color: colors.text }} />
    </div>
  );
}

export function SpendingLimitsModal({
  keyId,
  isOpen,
  onClose,
  enforceLimits,
  updateSpendingLimit,
  getRemainingLimit,
  onUpdated,
}: SpendingLimitsModalProps): ReactElement {
  const { tokens: allTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  useEffect(() => {
    if (allTokens.length === 0) return;
    const preferred = preferredFeeToken
      ? allTokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = allTokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? allTokens[0]);
  }, [allTokens, preferredFeeToken]);

  // Single-screen state
  const [tokenAddress, setTokenAddress] = useState('');
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const reset = useCallback(() => {
    setTokenAddress('');
    setLookup(null);
    setLookupLoading(false);
    setLookupError(null);
    setAmount('');
    setSubmitting(false);
    setRemoving(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Debounced auto-lookup when the token address becomes valid.
  useEffect(() => {
    const trimmed = tokenAddress.trim();
    if (!trimmed) {
      setLookup(null);
      setLookupError(null);
      setAmount('');
      return;
    }
    if (!isAddress(trimmed)) {
      setLookup(null);
      setLookupError('Invalid contract address');
      return;
    }
    if (lookup?.token.toLowerCase() === trimmed.toLowerCase()) return;

    let cancelled = false;
    setLookupLoading(true);
    setLookupError(null);

    void (async () => {
      try {
        const [metadata, limit] = await Promise.all([
          Actions.token.getMetadata(tempoPublicClient, { token: trimmed as Address }),
          getRemainingLimit(keyId as Address, trimmed as Address),
        ]);
        if (cancelled) return;
        if (!metadata || !metadata.name) {
          setLookupError('Token not found or not a valid TIP-20 token');
          setLookup(null);
          return;
        }
        const hasLimit = limit !== null && limit.periodEnd > 0n;
        const remaining = hasLimit && limit ? limit.remaining : null;
        const decimals = metadata.decimals ?? 18;
        setLookup({
          token: trimmed as Address,
          metadata: { ...metadata, decimals } as TokenMetadata,
          remaining,
        });
        if (remaining !== null) {
          setAmount(formatUnits(remaining, decimals));
        } else {
          setAmount('');
        }
      } catch {
        if (cancelled) return;
        setLookupError('Failed to fetch token. Please check the address.');
        setLookup(null);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, keyId, getRemainingLimit, lookup?.token]);

  const parsedAmount = parseFloat(amount || '0');
  const amountValid = parsedAmount > 0;

  const handleSubmit = useCallback(async () => {
    if (!lookup || !amountValid) return;
    setSubmitting(true);
    try {
      const decimals = lookup.metadata.decimals ?? 18;
      const newLimit = BigInt(Math.floor(parsedAmount * 10 ** decimals));
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: lookup.token,
        newLimit,
        feeToken: feeToken?.address,
      });
      toast.success(lookup.remaining !== null ? 'Limit updated' : 'Limit set', {
        description: `${lookup.metadata.symbol} limit: ${formatUnits(newLimit, decimals)}`,
      });
      await onUpdated();
      // Refresh the lookup to show the new remaining.
      setLookup(prev => (prev ? { ...prev, remaining: newLimit } : prev));
    } catch (err) {
      toast.error('Failed to update limit', {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [lookup, amountValid, parsedAmount, keyId, feeToken, updateSpendingLimit, onUpdated]);

  const handleRemove = useCallback(async () => {
    if (!lookup || lookup.remaining === null) return;
    setRemoving(true);
    try {
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: lookup.token,
        newLimit: 0n,
        feeToken: feeToken?.address,
      });
      toast.success('Limit removed', {
        description: `${lookup.metadata.symbol} limit cleared.`,
      });
      await onUpdated();
      setLookup(prev => (prev ? { ...prev, remaining: null } : prev));
      setAmount('');
    } catch (err) {
      toast.error('Failed to remove limit', {
        description: (err as Error).message,
      });
    } finally {
      setRemoving(false);
    }
  }, [lookup, keyId, feeToken, updateSpendingLimit, onUpdated]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const hasLimit = lookup?.remaining !== null && lookup?.remaining !== undefined;
  const decimals = lookup?.metadata.decimals ?? 18;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="p-0 gap-0 max-w-[440px] rounded-3xl overflow-visible border-none shadow-[0_20px_50px_-20px_rgba(45,52,54,0.2)]">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-[#FDFBF8] border-b border-[#EDE9E3] rounded-t-3xl">
          <div className="pr-10">
            <DialogTitle className="text-[15px] font-semibold text-[#2D3436] tracking-tight leading-tight">
              Manage Spending Limits
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#9B9590] mt-0.5 font-mono">
              Key {formatAddress(keyId, 6)}
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 min-h-[380px]">
          {!enforceLimits && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]">
              <Shield className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#9B9590] leading-relaxed">
                This key was authorized with unlimited spending. Setting a limit here will not take
                effect unless the key was created with limits enabled.
              </p>
            </div>
          )}

          {/* Token picker */}
          <TokenAddressPicker
            value={tokenAddress}
            onChange={val => {
              setTokenAddress(val);
              setLookupError(null);
            }}
            label="Token"
            showValidation={false}
          />

          {lookupError && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
              <p className="text-[11.5px] text-[#E5484D]">{lookupError}</p>
            </div>
          )}

          {/* Status card - appears after a successful lookup */}
          {lookup && !lookupLoading && (
            <div
              className={`rounded-2xl border p-3.5 flex items-center gap-3 ${
                hasLimit
                  ? 'border-[#6B8F71]/20 bg-[#6B8F71]/[0.05]'
                  : 'border-[#EDE9E3] bg-[#FDFBF8]'
              }`}
            >
              <TokenIcon
                symbol={lookup.metadata.symbol}
                logoURI={
                  allTokens.find(t => t.address.toLowerCase() === lookup.token.toLowerCase())
                    ?.logoURI
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#2D3436]">
                  {lookup.metadata.symbol}
                  <span className="font-normal text-[#9B9590] ml-1.5 text-[11.5px]">
                    {lookup.metadata.name}
                  </span>
                </p>
                <p className="text-[11.5px] mt-0.5">
                  {hasLimit ? (
                    <span className="text-[#6B8F71] font-medium">
                      {formatUnits(lookup.remaining as bigint, decimals)} remaining
                    </span>
                  ) : (
                    <span className="text-[#9B9590]">No limit set</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {lookupLoading && (
            <div className="rounded-2xl border border-[#EDE9E3] bg-white p-3.5 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#B5B0AA]" />
              <p className="text-[12px] text-[#9B9590]">Checking token…</p>
            </div>
          )}

          {/* Amount input - only shown when we have a valid token */}
          {lookup && !lookupLoading && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                {hasLimit ? 'New Limit' : 'Set Limit'}
              </Label>
              <div className="relative">
                <Input
                  placeholder="0.00"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-11 rounded-xl text-[13px] border-[#EDE9E3] pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#9B9590]">
                  {lookup.metadata.symbol}
                </span>
              </div>
              <p className="text-[11px] text-[#B5B0AA]">
                Max {lookup.metadata.symbol} this key can spend from your account.
              </p>
            </div>
          )}

          {/* Fee token */}
          {lookup && !lookupLoading && feeToken && allTokens.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
              <FeeTokenPicker value={feeToken} tokens={allTokens} onChange={setFeeToken} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {hasLimit && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={removing || submitting}
              className="h-12 px-4 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting || removing}
            className="flex-1 h-12 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            Close
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!lookup || !amountValid || submitting || removing}
            className="flex-1 h-12 text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15 hover:shadow-xl hover:shadow-[#E07A5F]/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : hasLimit ? (
              'Update Limit'
            ) : (
              'Set Limit'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
