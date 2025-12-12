import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Link2, Check, CircleDollarSign, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePolicies } from '@/hooks/usePolicies';
import { useStablecoins } from '@/hooks/useStablecoins';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { Address } from 'viem';

interface LinkTokenModalProps {
  isOpen: boolean;
  policyId: bigint;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm' | 'success';

export function LinkTokenModal({
  isOpen,
  policyId,
  onSuccess,
  onClose,
}: LinkTokenModalProps): ReactElement {
  const { linkToToken } = usePolicies();
  const { stablecoins, isLoading: isLoadingTokens } = useStablecoins();

  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedToken('');
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
    }
  }, [isOpen]);

  const handleReview = useCallback((): void => {
    if (!selectedToken) {
      toast.error('Please select a token');
      return;
    }
    setModalState('confirm');
  }, [selectedToken]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedToken) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await linkToToken({
        token: selectedToken,
        policyId,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedToken, policyId, feeToken, linkToToken, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const selectedCoin = stablecoins.find(c => c.address === selectedToken);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Link to Token</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Apply this policy to a TIP20 token for transfer restrictions
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Select Token
                  </label>
                  {isLoadingTokens ? (
                    <div className="h-10 flex items-center justify-center bg-muted rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : stablecoins.length === 0 ? (
                    <div className="h-10 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">
                      No tokens found
                    </div>
                  ) : (
                    <Select
                      value={selectedToken}
                      onValueChange={v => setSelectedToken(v as Address)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a token" />
                      </SelectTrigger>
                      <SelectContent>
                        {stablecoins.map(coin => (
                          <SelectItem key={coin.address} value={coin.address}>
                            <div className="flex items-center gap-2">
                              <CircleDollarSign className="h-4 w-4 text-primary" />
                              <span>
                                {coin.name} ({coin.symbol})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Select a token from your TIP20 Studio list
                  </p>
                </div>

                <FeeTokenSelector
                  value={feeToken}
                  onChange={setFeeToken}
                  className="pt-4 border-t border-border"
                />
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleReview} disabled={!selectedToken}>
                  Review
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && selectedCoin && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Confirm Link</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                This will apply the policy to the selected token
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              {/* Token Info Card */}
              <div className="bg-primary/5 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CircleDollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Token</p>
                    <p className="text-lg font-semibold text-foreground">
                      {selectedCoin.name} ({selectedCoin.symbol})
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token Address</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(selectedCoin.address, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="text-xs font-mono text-foreground">{policyId.toString()}</span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-amber-700">
                  All transfers of this token will be subject to the policy restrictions.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('form')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Link Policy
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && selectedCoin && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">Policy Linked!</DialogTitle>
            <DialogDescription className="sr-only">
              The policy has been applied to the token
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Policy Applied</p>

              {/* Token name */}
              <div className="mb-6">
                <span className="text-xl font-semibold text-foreground">{selectedCoin.name}</span>
                <span className="text-lg text-muted-foreground ml-1.5">
                  ({selectedCoin.symbol})
                </span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="font-mono text-xs text-foreground">
                    {formatAddress(selectedCoin.address, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="font-mono text-xs text-foreground">{policyId.toString()}</span>
                </div>
                {txHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transaction</span>
                    <button
                      onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="font-mono">
                        {txHash.slice(0, 8)}...{txHash.slice(-4)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <Button className="w-full h-10" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
