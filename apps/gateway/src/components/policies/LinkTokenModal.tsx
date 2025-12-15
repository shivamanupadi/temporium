import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Link2, Check, CircleDollarSign, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { TokenAddressInput } from '@/components/TokenAddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { Actions, tempoPublicClient, getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress, isValidAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { Address } from 'viem';
import type { PolicyType } from '@/types';

interface LinkTokenModalProps {
  isOpen: boolean;
  policyId: bigint;
  policyType?: PolicyType;
  policyAdmin?: Address;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'input' | 'confirm' | 'success';

interface TokenPreview {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

export function LinkTokenModal({
  isOpen,
  policyId,
  policyType,
  policyAdmin,
  onSuccess,
  onClose,
}: LinkTokenModalProps): ReactElement {
  const { linkToToken } = usePolicies();

  const [tokenAddressInput, setTokenAddressInput] = useState('');
  const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTokenAddressInput('');
      setTokenPreview(null);
      setModalState('input');
      setIsLoading(false);
      setIsSubmitting(false);
      setTxHash('');
      setFeeToken(null);
    }
  }, [isOpen]);

  const handleLookup = useCallback(async (): Promise<void> => {
    if (!tokenAddressInput) {
      toast.error('Please enter a token address');
      return;
    }

    if (!isValidAddress(tokenAddressInput)) {
      toast.error('Please enter a valid token address');
      return;
    }

    setIsLoading(true);
    try {
      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: tokenAddressInput as Address,
      });

      setTokenPreview({
        address: tokenAddressInput as Address,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
      });
      setModalState('confirm');
    } catch (error) {
      toast.error('Token not found or invalid');
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddressInput]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!tokenPreview) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await linkToToken({
        token: tokenPreview.address,
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
  }, [tokenPreview, policyId, feeToken, linkToToken, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const isWhitelist = policyType === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Link to Token</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Apply this policy to a TIP20 token for transfer restrictions
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <TokenAddressInput
                  label="Token Address"
                  value={tokenAddressInput}
                  onChange={setTokenAddressInput}
                  placeholder="0x..."
                />

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
                <Button
                  className="flex-1"
                  onClick={handleLookup}
                  disabled={!tokenAddressInput || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading
                    </>
                  ) : (
                    'Lookup'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && tokenPreview && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Confirm Link</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review token details before linking
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
                      {tokenPreview.name} ({tokenPreview.symbol})
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token Address</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(tokenPreview.address, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="text-xs font-mono text-foreground">{policyId.toString()}</span>
                </div>
                {policyType && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Policy Type</span>
                    <span
                      className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
                    </span>
                  </div>
                )}
                {policyAdmin && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Policy Admin</span>
                    <span className="text-xs font-mono text-foreground">
                      {formatAddress(policyAdmin, 8)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-amber-700">
                  {policyType
                    ? isWhitelist
                      ? 'Only addresses in the whitelist will be able to transfer this token.'
                      : 'Addresses in the blacklist will be blocked from transferring this token.'
                    : 'All transfers of this token will be subject to the policy restrictions.'}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('input')}
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
                    Link Token
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && tokenPreview && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">Token Linked!</DialogTitle>
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
                <span className="text-xl font-semibold text-foreground">{tokenPreview.name}</span>
                <span className="text-lg text-muted-foreground ml-1.5">
                  ({tokenPreview.symbol})
                </span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy</span>
                  <span
                    className={`text-xs font-medium ${policyType ? (isWhitelist ? 'text-emerald-600' : 'text-rose-600') : 'text-foreground'}`}
                  >
                    {policyType
                      ? `${isWhitelist ? 'Whitelist' : 'Blacklist'} #${policyId.toString()}`
                      : policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="font-mono text-xs text-foreground">
                    {formatAddress(tokenPreview.address, 8)}
                  </span>
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
