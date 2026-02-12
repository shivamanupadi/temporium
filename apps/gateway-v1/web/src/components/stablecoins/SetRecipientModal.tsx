import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
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
  const { tokens } = useTokenList();

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
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, mode, userAddress, tokens]);

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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">{successTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {isOptIn ? 'You are now receiving reward distributions' : 'You have opted out of reward distributions'}
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Sage checkmark */}
              <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-[15px] font-bold text-[#2D3436] mb-1">{successTitle}</h3>

              {/* Hero value */}
              <div className="mb-6">
                <span className={`text-3xl font-bold ${isOptIn ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                  {isOptIn ? 'Opted In' : 'Opted Out'}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                {isOptIn && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Recipient
                    </span>
                    <span className="text-[13px] text-[#2D3436] font-mono">
                      {formatAddress(recipient, 8)}
                    </span>
                  </div>
                )}
                <div className={`flex items-center justify-between ${isOptIn ? 'pt-2 border-t border-[#EDE9E3]' : ''}`}>
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Transaction
                  </span>
                  <button
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex items-center gap-1 text-[13px] text-sage hover:text-sage/80 transition-colors"
                  >
                    <span className="font-mono">
                      {txHash.slice(0, 8)}...{txHash.slice(-4)}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Two-button footer */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Explorer
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590] mt-1">
                {description}
              </DialogDescription>
            </div>

            {/* Form body */}
            <div className="px-6 pb-4 space-y-3">
              {/* Info banner */}
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border ${isOptIn ? 'bg-[var(--color-sage)]/10 border-[var(--color-sage)]/30' : 'bg-coral/10 border-coral/30'}`}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isOptIn ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                />
                <p className="text-[12px] text-[#9B9590]">{description}</p>
              </div>

              {/* Recipient address input (opt-in only) */}
              {isOptIn && (
                <div>
                  <ContactPicker
                    value={recipient}
                    onChange={setRecipientAddress}
                    label="Reward Recipient"
                  />
                  {userAddress && recipient.toLowerCase() === userAddress.toLowerCase() && (
                    <p className="text-[11px] text-[var(--color-sage)] mt-1">
                      Rewards will be sent to your address
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Fee token picker */}
            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}

            {/* Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isOptIn ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={handleSubmit}
                disabled={isSubmitting || (isOptIn && !recipient)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
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
      </DialogContent>
    </Dialog>
  );
}
