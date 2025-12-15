import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ExternalLink, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { AddressInput } from '@/components/AddressInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { Token } from '@/lib/tokenlist';
import type { Address } from 'viem';

interface SetRecipientModalProps {
  isOpen: boolean;
  mode: 'opt-in' | 'opt-out';
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export function SetRecipientModal({
  isOpen,
  mode,
  selectedCoin,
  onSuccess,
  onClose,
}: SetRecipientModalProps): ReactElement {
  const { address: userAddress } = useAccount();
  const { setRecipient } = useRewards({ token: selectedCoin?.address });

  const [recipient, setRecipientAddress] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // For opt-in, default to user's own address
      setRecipientAddress(mode === 'opt-in' ? (userAddress ?? '') : '');
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, mode, userAddress]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin) {
      toast.error('No token selected');
      return;
    }

    // For opt-out, use zero address
    const recipientAddress = mode === 'opt-out' ? ZERO_ADDRESS : (recipient as Address);

    if (mode === 'opt-in' && !recipient) {
      toast.error('Please enter a recipient address');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await setRecipient({
        recipient: recipientAddress,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${mode === 'opt-in' ? 'opt in to' : 'opt out of'} rewards`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, mode, recipient, feeToken, setRecipient, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const isOptIn = mode === 'opt-in';
  const Icon = isOptIn ? UserCheck : UserX;
  const title = isOptIn ? 'Opt In to Rewards' : 'Opt Out of Rewards';
  const successTitle = isOptIn ? 'Opted In!' : 'Opted Out!';
  const description = isOptIn
    ? 'Set a recipient address to receive your share of reward distributions. You can set yourself or delegate to another address.'
    : "Stop receiving reward distributions. Any unclaimed rewards will remain claimable, but you won't receive future distributions.";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? successTitle : title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              {/* Success icon */}
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6 ${isOptIn ? 'bg-emerald-500' : 'bg-amber-500'}`}
              >
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">
                {isOptIn ? 'Now Receiving Rewards' : 'No Longer Receiving Rewards'}
              </p>

              {/* Recipient info for opt-in */}
              {isOptIn && (
                <div className="mb-6">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <p className="font-mono text-foreground">{formatAddress(recipient, 8)}</p>
                </div>
              )}

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span
                    className={`text-xs font-medium ${isOptIn ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {isOptIn ? 'Opted In' : 'Opted Out'}
                  </span>
                </div>
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
              </div>

              <Button className="w-full h-10" onClick={handleClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div
                className={`flex items-start gap-3 p-3 rounded-xl mb-4 ${isOptIn ? 'bg-emerald-50' : 'bg-amber-50'}`}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isOptIn ? 'text-emerald-600' : 'text-amber-600'}`}
                />
                <p className="text-[12px] text-muted-foreground">{description}</p>
              </div>

              {isOptIn && (
                <div className="space-y-4">
                  <AddressInput
                    label="Reward Recipient"
                    value={recipient}
                    onChange={setRecipientAddress}
                  />
                  {userAddress && recipient.toLowerCase() === userAddress.toLowerCase() && (
                    <p className="text-[11px] text-emerald-600">
                      Rewards will be sent to your address
                    </p>
                  )}
                </div>
              )}

              <FeeTokenSelector
                value={feeToken}
                onChange={setFeeToken}
                className={`pt-4 ${isOptIn ? 'mt-4' : 'mt-0'} border-t border-border`}
              />

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 h-10 ${isOptIn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || (isOptIn && !recipient)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isOptIn ? 'Opting In' : 'Opting Out'}
                    </>
                  ) : isOptIn ? (
                    'Opt In'
                  ) : (
                    'Opt Out'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
