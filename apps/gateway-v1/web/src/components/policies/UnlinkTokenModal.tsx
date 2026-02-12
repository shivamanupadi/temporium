import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, AlertCircle, ShieldOff, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { Actions, tempoPublicClient, getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { usePolicies } from '@/hooks/usePolicies';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import type { PolicyType, TokenMetadata } from '@/types';

interface UnlinkTokenModalProps {
  isOpen: boolean;
  policyId: bigint;
  policyType?: PolicyType;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'input' | 'confirm' | 'success';

export function UnlinkTokenModal({
  isOpen,
  policyId,
  policyType,
  onSuccess,
  onClose,
}: UnlinkTokenModalProps): ReactElement {
  const { unlinkFromToken } = usePolicies();
  const { tokens } = useTokenList();

  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTokenAddress('');
      setTokenMetadata(null);
      setFeeToken(tokens[0] ?? null);
      setModalState('input');
      setIsLoading(false);
      setIsSubmitting(false);
      setTxHash('');
      setError(null);
    }
  }, [isOpen, tokens]);

  const isWhitelist = policyType === 'whitelist';

  const handleLookup = useCallback(async (): Promise<void> => {
    const trimmed = tokenAddress.trim();

    if (!trimmed) {
      setError('Please enter a token address');
      return;
    }

    if (!isAddress(trimmed)) {
      setError('Invalid address format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: trimmed as Address,
      });

      if (!metadata || !metadata.name) {
        setError('Token not found or invalid');
        setIsLoading(false);
        return;
      }

      // Verify the token's current transfer policy matches this policy
      if (metadata.transferPolicyId === undefined || metadata.transferPolicyId === null) {
        setError('This token has no transfer policy linked');
        setIsLoading(false);
        return;
      }

      if (metadata.transferPolicyId !== policyId) {
        setError(
          `This token is linked to policy #${metadata.transferPolicyId.toString()}, not #${policyId.toString()}`
        );
        setIsLoading(false);
        return;
      }

      setTokenMetadata(metadata as TokenMetadata);
      setModalState('confirm');
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError('Failed to fetch token. Please check the address.');
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, policyId]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = tokenAddress.trim();

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await unlinkFromToken({
        token: trimmed as Address,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlink policy from token';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [tokenAddress, feeToken, unlinkFromToken, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Unlink from Token</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Remove this policy from a TIP20 token
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Token Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={e => {
                    setTokenAddress(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors"
                />
                {error && (
                  <div className="flex items-center gap-1.5 mt-2 text-coral">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="text-[12px]">{error}</span>
                  </div>
                )}
              </div>
            </div>

            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={handleLookup}
                disabled={isLoading || !tokenAddress.trim()}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isLoading ? 'Looking up...' : 'Lookup'}
              </Button>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && tokenMetadata && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Confirm Unlink</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review details before removing the policy
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              {/* Token Info Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                  Token
                </p>
                <p className="text-lg font-bold text-[#2D3436]">
                  {tokenMetadata.name}{' '}
                  <span className="text-[14px] font-semibold text-[#9B9590]">
                    {tokenMetadata.symbol}
                  </span>
                </p>
              </div>

              {/* Details Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Current Policy</span>
                  <span className="flex items-center gap-1.5">
                    {isWhitelist ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-sage)]" />
                    ) : (
                      <ShieldX className="h-3.5 w-3.5 text-coral" />
                    )}
                    <span className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                      {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">After Unlink</span>
                  <span className="text-[13px] font-medium text-[#9B9590]">No restrictions</span>
                </div>
              </div>

              {/* Warning box */}
              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3">
                <p className="text-xs text-[var(--color-warning)]">
                  After unlinking, all addresses will be able to send and receive this token without
                  restrictions.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('input')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Unlinking
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    Unlink
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && tokenMetadata && (
          <>
            <DialogTitle className="sr-only">Policy Removed!</DialogTitle>
            <DialogDescription className="sr-only">Transfer policy removed successfully</DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Success icon */}
              <div className="inline-flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">Policy Removed!</p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{tokenMetadata.name}</span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Token</span>
                  <span className="text-[13px] font-medium text-[#2D3436]">
                    {tokenMetadata.name} ({tokenMetadata.symbol})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Previous Policy</span>
                  <span className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">New Policy</span>
                  <span className="text-[13px] font-medium text-[#9B9590]">No Restrictions</span>
                </div>
                {txHash && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Transaction</span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {txHash.slice(0, 10)}...{txHash.slice(-4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              {txHash && (
                <Button
                  variant="outline"
                  onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                  className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Explorer
                </Button>
              )}
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
