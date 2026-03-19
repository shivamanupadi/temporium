import { useState, useEffect, type ReactElement } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Check, CheckCircle, DollarSign, ArrowRight, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import type { Token } from '@/lib/tokenlist';
import { getTokenColors } from '@/lib/tokenlist';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { tempoChain } from '@/lib/tempo-client';
import { LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/portal/settings/fee-token')({
  component: FeeTokenSettings,
});

function TokenIcon({ token }: { token: Token }): ReactElement {
  const colors = getTokenColors(token.symbol);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="w-8 h-8 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn('h-4 w-4', token.logoURI && 'hidden')}
        style={{ color: colors.text }}
      />
    </div>
  );
}

function FeeTokenSettings(): ReactElement | null {
  const { isConnected, address } = useTempo();
  const { tokens, officialTokens } = useTokenList();
  const { preferredFeeToken, isLoading: prefLoading, setFeePreference } = useFeePreference();

  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [dialogStep, setDialogStep] = useState<'closed' | 'confirm' | 'saving' | 'success'>(
    'closed'
  );
  const [txFeeToken, setTxFeeToken] = useState<Token | null>(null);

  // Initialize tx fee token
  useEffect(() => {
    if (tokens.length > 0 && !txFeeToken) {
      const chainDefault = tokens.find(
        t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
      );
      setTxFeeToken(chainDefault ?? tokens[0]);
    }
  }, [tokens, txFeeToken]);

  if (!isConnected || !address) return null;

  const onChainAddress = preferredFeeToken?.toLowerCase() ?? null;
  const hasChanged = selectedAddress !== null && selectedAddress !== onChainAddress;
  const activeAddress = selectedAddress ?? onChainAddress;

  const selectedToken = selectedAddress
    ? officialTokens.find(t => t.address.toLowerCase() === selectedAddress)
    : null;

  const currentToken = onChainAddress
    ? officialTokens.find(t => t.address.toLowerCase() === onChainAddress)
    : null;

  const isSaving = dialogStep === 'saving';

  const handleConfirmSave = async (): Promise<void> => {
    if (!selectedToken) return;
    setDialogStep('saving');
    try {
      await setFeePreference(selectedToken.address, txFeeToken?.address);
      setDialogStep('success');
    } catch (err) {
      console.error('Failed to save fee preference:', err);
      setDialogStep('confirm');
    }
  };

  const handleDialogClose = (): void => {
    if (isSaving) return;
    if (dialogStep === 'success') {
      setSelectedAddress(null);
    }
    setDialogStep('closed');
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#EDE9E3]">
        <div className="p-5 pb-4">
          <h2 className="text-[15px] font-semibold text-[#2D3436]">Fee Token Preference</h2>
          <p className="text-[13px] text-[#9B9590] mt-1">
            Choose the default token used to pay network fees. This is stored on-chain and applies
            across all apps.
          </p>
        </div>

        {/* Token list */}
        <div className="px-3 pb-2">
          {prefLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-4 h-4 text-[#9B9590] animate-spin" />
              <span className="text-[13px] text-[#9B9590]">Loading preference...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {officialTokens.map(token => {
                const addr = token.address.toLowerCase();
                const isActive = activeAddress === addr;
                const isOnChain = onChainAddress === addr;
                const isChainDefault =
                  addr === tempoChain.feeToken.toLowerCase() && !onChainAddress;

                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => setSelectedAddress(addr)}
                    disabled={isSaving}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all',
                      isActive
                        ? 'bg-[#E07A5F]/[0.07] ring-1 ring-[#E07A5F]/20'
                        : 'hover:bg-[#F5F2ED]'
                    )}
                  >
                    <TokenIcon token={token} />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-[13px] font-semibold leading-none',
                          isActive ? 'text-[#E07A5F]' : 'text-[#2D3436]'
                        )}
                      >
                        {token.symbol}
                      </p>
                      <p className="text-[11px] text-[#9B9590] mt-0.5 leading-none truncate">
                        {token.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOnChain && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#6B8F71]/10 text-[#6B8F71] font-semibold uppercase tracking-wide">
                          Current
                        </span>
                      )}
                      {isChainDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#9B9590]/10 text-[#9B9590] font-semibold uppercase tracking-wide">
                          Default
                        </span>
                      )}
                      {isActive && (
                        <div className="w-5 h-5 rounded-full bg-[#E07A5F] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>

                    <a
                      href={`${LINKS.explorer}/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[#B5B0AA] hover:text-[#6B6560] transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Review button */}
        <div className="px-5 pb-5 pt-3">
          <Button
            disabled={!hasChanged || isSaving}
            onClick={() => setDialogStep('confirm')}
            className={cn(
              'w-full h-12 text-[14px] font-semibold transition-all',
              hasChanged
                ? 'bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15'
                : 'bg-[#EDE9E3] text-[#9B9590] cursor-not-allowed'
            )}
          >
            Review Change
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Confirmation / Success Dialog */}
      <Dialog
        open={dialogStep !== 'closed'}
        onOpenChange={o => {
          if (!o) handleDialogClose();
        }}
      >
        <DialogContent hideClose={isSaving} className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
          <AnimatePresence mode="wait">
            {/* Confirm */}
            {dialogStep === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="px-6 pt-6 pb-4">
                  <DialogTitle className="text-lg font-bold text-[#2D3436]">
                    Confirm Fee Token Change
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                    This will send a transaction to update your on-chain preference
                  </DialogDescription>
                </div>

                <div className="px-6 pb-4 space-y-3">
                  <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">Current</span>
                      <span className="text-[13px] font-medium text-[#2D3436]">
                        {currentToken?.symbol ?? 'pathUSD (default)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">New</span>
                      <span className="text-[13px] font-semibold text-[#E07A5F]">
                        {selectedToken?.symbol}
                      </span>
                    </div>
                  </div>

                  {txFeeToken && tokens.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
                      <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                      <FeeTokenPicker value={txFeeToken} tokens={tokens} onChange={setTxFeeToken} />
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleDialogClose}
                    className="flex-1 h-12 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmSave}
                    className="flex-1 h-12 font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15"
                  >
                    Confirm
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Saving */}
            {dialogStep === 'saving' && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DialogTitle className="sr-only">Saving</DialogTitle>
                <DialogDescription className="sr-only">
                  Updating your fee preference
                </DialogDescription>
                <div className="px-6 py-14 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#E07A5F]/10 flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#E07A5F]" />
                  </div>
                  <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                    Updating Preference
                  </p>
                  <p className="text-xl font-bold text-[#2D3436]">
                    Switching to {selectedToken?.symbol}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Success */}
            {dialogStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <DialogTitle className="sr-only">Preference Updated</DialogTitle>
                <DialogDescription className="sr-only">
                  Fee token preference saved
                </DialogDescription>
                <div className="px-6 pt-10 pb-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="inline-flex mb-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#6B8F71] flex items-center justify-center">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-white"
                      >
                        <motion.path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.4, delay: 0.3 }}
                        />
                      </svg>
                    </div>
                  </motion.div>
                  <p className="text-[15px] font-bold text-[#2D3436] mb-1">Preference Updated</p>
                  <p className="text-[13px] text-[#9B9590]">
                    Your default fee token is now{' '}
                    <span className="font-semibold text-[#2D3436]">{selectedToken?.symbol}</span>
                  </p>
                </div>
                <div className="px-6 pb-6">
                  <Button
                    onClick={handleDialogClose}
                    className="w-full h-12 font-semibold bg-[#6B8F71] hover:bg-[#5A7D60] text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
