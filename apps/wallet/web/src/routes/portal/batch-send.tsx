import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  ListPlus,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import type { Token } from '@/lib/tokenlist';
import { tempoChain } from '@/lib/tempo-client';
import {
  formatAmount,
  parseAmount,
  formatAddress,
  isValidAddress,
  copyToClipboard,
} from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/batch-send')({
  component: BatchSendPage,
});

type FlowStep = 'form' | 'confirm' | 'sending' | 'success';

interface RecipientRow {
  id: string;
  address: string;
  amount: string;
}

function createRow(): RecipientRow {
  return { id: crypto.randomUUID(), address: '', amount: '' };
}

// Component

function BatchSendPage(): ReactElement | null {
  const { address, isConnected, batchSend } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([createRow(), createRow()]);
  const [step, setStep] = useState<FlowStep>('form');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) setSelectedToken(tokens[0]);
  }, [tokens, selectedToken]);

  useEffect(() => {
    if (tokens.length === 0) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, preferredFeeToken]);

  const balance = useTokenBalance(selectedToken?.address, address);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Derived

  const tokenDecimals = selectedToken?.decimals ?? 6;

  const parsedRecipients = recipients.map(r => ({
    ...r,
    parsed: parseAmount(r.amount, tokenDecimals),
    validAddress: isValidAddress(r.address),
    validAmount: parseAmount(r.amount, tokenDecimals) > 0n,
  }));

  const totalAmount = parsedRecipients.reduce((sum, r) => sum + r.parsed, 0n);
  const validCount = parsedRecipients.filter(r => r.validAddress && r.validAmount).length;
  const hasSufficientBalance = !balance.isLoading && balance.data.value >= totalAmount;
  const isFormValid =
    validCount >= 2 && validCount === recipients.length && hasSufficientBalance && totalAmount > 0n;

  // Handlers

  const updateRecipient = useCallback((id: string, field: 'address' | 'amount', value: string) => {
    setRecipients(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, [field]: field === 'amount' ? value.replace(/[^0-9.]/g, '') : value }
          : r
      )
    );
  }, []);

  const addRecipient = useCallback(() => {
    setRecipients(prev => [...prev, createRow()]);
  }, []);

  const removeRecipient = useCallback((id: string) => {
    setRecipients(prev => (prev.length <= 2 ? prev : prev.filter(r => r.id !== id)));
  }, []);

  const handleReview = useCallback(() => {
    if (!isFormValid) return;
    setStep('confirm');
  }, [isFormValid]);

  const handleConfirmSend = useCallback(async () => {
    if (!isFormValid || !address || !selectedToken || !feeToken) return;
    setStep('sending');

    try {
      const transfers = parsedRecipients.map(r => ({
        to: r.address as Address,
        amount: r.parsed,
      }));

      const hash = await batchSend({
        token: selectedToken.address,
        transfers,
        feeToken: feeToken.address,
      });

      setTxHash(hash);
      setStep('success');
      toast.success(`Batch sent to ${transfers.length} recipients`);
    } catch (err) {
      console.error('Batch send failed:', err);
      const message = err instanceof Error ? err.message : 'Transaction failed';
      toast.error(message);
      setStep('confirm');
    }
  }, [isFormValid, address, selectedToken, feeToken, parsedRecipients, batchSend]);

  const handleCopyTxHash = useCallback(async () => {
    if (!txHash) return;
    const ok = await copyToClipboard(txHash);
    if (ok) {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [txHash]);

  const resetForm = useCallback(() => {
    setRecipients([createRow(), createRow()]);
    setStep('form');
    setTxHash(null);
    setCopied(false);
  }, []);

  const handleDialogClose = useCallback(() => {
    if (step === 'sending') return;
    if (step === 'success') {
      resetForm();
    } else {
      setStep('form');
    }
  }, [step, resetForm]);

  // Guard

  if (!isConnected || !address || !selectedToken || !feeToken) return null;

  const balanceDisplay = balance.isLoading
    ? '...'
    : formatAmount(balance.data.value, tokenDecimals, 2);

  const formattedTotal = totalAmount > 0n ? formatAmount(totalAmount, tokenDecimals, 2) : '0.00';

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Batch Send</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Send tokens to multiple recipients in a single transaction
        </p>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm"
      >
        <div className="p-5 space-y-5">
          {/* Token selector + balance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Token
              </label>
              <span className="text-[11px] font-medium text-[#9B9590]">
                Balance: {balanceDisplay} {selectedToken.symbol}
              </span>
            </div>
            <TokenPicker
              token={selectedToken}
              tokens={tokens}
              onChange={setSelectedToken}
              accentColor="#E07A5F"
            />
          </div>

          {/* Recipients */}
          <div>
            <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
              Recipients ({recipients.length})
            </label>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {recipients.map((row, idx) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-[#FDFBF8] rounded-xl border border-[#EDE9E3] p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-[#B5B0AA] shrink-0 w-5 text-center leading-10">
                          #{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <ContactPicker
                            value={row.address}
                            onChange={v => updateRecipient(row.id, 'address', v)}
                            compact
                            selfAddress={address}
                          />
                        </div>
                        <div className="w-32 shrink-0">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateRecipient(row.id, 'amount', e.target.value)
                            }
                            className="text-[14px] font-semibold h-10 rounded-xl border-[#EDE9E3] bg-white focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]/20 transition-all"
                          />
                        </div>
                        {recipients.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => removeRecipient(row.id)}
                            className="p-1 rounded-md hover:bg-red-50 text-[#B5B0AA] hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="w-[26px] shrink-0" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={addRecipient}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#EDE9E3] text-[13px] font-medium text-[#9B9590] hover:border-[#E07A5F]/40 hover:text-[#E07A5F] hover:bg-[#E07A5F]/[0.03] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Recipient
            </button>
          </div>

          {/* Fee token */}
          <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />

          {/* Summary */}
          {totalAmount > 0n && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#FDFBF8] rounded-xl border border-[#EDE9E3] p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Total
                </span>
                <span className="text-[15px] font-bold text-[#2D3436]">
                  {formattedTotal} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Recipients
                </span>
                <span className="text-[13px] font-medium text-[#6B6560]">
                  {validCount} address{validCount !== 1 ? 'es' : ''}
                </span>
              </div>
              {!hasSufficientBalance && totalAmount > 0n && (
                <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient balance
                </p>
              )}
            </motion.div>
          )}

          {/* Divider */}
          <div className="border-t border-[#EDE9E3]" />

          {/* Submit */}
          <Button
            disabled={!isFormValid}
            onClick={handleReview}
            className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white transition-all"
          >
            Review Batch Send
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </motion.div>

      {/* Confirmation / Sending / Success Dialog */}
      <Dialog
        open={step !== 'form'}
        onOpenChange={(open: boolean) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent
          hideClose={step === 'sending'}
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl"
        >
          <AnimatePresence mode="wait">
            {/* Confirm */}
            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-6 pt-6 pb-4">
                  <DialogTitle className="text-lg font-bold text-[#2D3436]">
                    Confirm Batch Send
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                    Sending to {validCount} recipients in one transaction
                  </DialogDescription>
                </div>

                <div className="px-6 pb-4 space-y-3">
                  <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                      Total Amount
                    </p>
                    <p className="text-2xl font-bold text-[#2D3436]">
                      {formattedTotal}{' '}
                      <span className="text-[15px] font-semibold text-[#9B9590]">
                        {selectedToken.symbol}
                      </span>
                    </p>
                  </div>

                  <div className="bg-[#FDFBF8] rounded-xl border border-[#EDE9E3] divide-y divide-[#EDE9E3]">
                    {parsedRecipients
                      .filter(r => r.validAddress && r.validAmount)
                      .map((r, i) => (
                        <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-[#9B9590] font-medium">#{i + 1}</p>
                            <p className="font-mono text-[12px] text-[#2D3436]">
                              {formatAddress(r.address, 6)}
                            </p>
                          </div>
                          <p className="text-[13px] font-semibold text-[#2D3436]">
                            {formatAmount(r.parsed, tokenDecimals, 2)} {selectedToken.symbol}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('form')}
                    className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmSend}
                    className="flex-1 h-11 rounded-xl font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white"
                  >
                    <ListPlus className="w-3.5 h-3.5 mr-1.5" />
                    Send All
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Sending */}
            {step === 'sending' && (
              <motion.div
                key="sending"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">Processing</DialogTitle>
                <DialogDescription className="sr-only">
                  Your batch send is being processed
                </DialogDescription>

                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-16 -left-16 w-48 h-48 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(224,122,95,0.2) 0%, transparent 70%)',
                    }}
                  />
                </div>

                <div className="relative px-6 py-14 text-center">
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-12 h-12 rounded-full bg-[#E07A5F]/10 flex items-center justify-center"
                    >
                      <Loader2 className="w-5 h-5 animate-spin text-[#E07A5F]" />
                    </motion.div>
                  </div>
                  <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                    Sending Batch
                  </p>
                  <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                    {formattedTotal}
                    <span className="text-lg font-semibold text-[#9B9590] ml-2">
                      {selectedToken.symbol}
                    </span>
                  </p>
                  <p className="mt-2 text-[12px] text-[#9B9590]">
                    to {validCount} recipient{validCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Success */}
            {step === 'success' && txHash && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">Batch Sent</DialogTitle>
                <DialogDescription className="sr-only">
                  Your batch payment has been completed
                </DialogDescription>

                <div className="px-6 pt-10 pb-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="inline-flex items-center justify-center mb-6"
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[#5B9A6F]">
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
                          transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
                        />
                      </svg>
                    </div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-[15px] font-bold text-[#2D3436] mb-1"
                  >
                    Batch Sent
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mb-6"
                  >
                    <span className="text-3xl font-bold text-[#2D3436]">{formattedTotal}</span>
                    <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                      {selectedToken.symbol}
                    </span>
                    <p className="text-[13px] text-[#9B9590] mt-1">
                      to {validCount} recipient{validCount !== 1 ? 's' : ''}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Tx Hash
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] text-[#2D3436]">
                          {txHash.slice(0, 10)}...{txHash.slice(-4)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyTxHash}
                          className="p-1 rounded-md hover:bg-[#F5F2ED] transition-colors"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-[#5B9A6F]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#9B9590]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="px-6 pb-6 flex gap-3"
                >
                  <Button
                    variant="outline"
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Explorer
                  </Button>
                  <Button
                    onClick={resetForm}
                    className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Done
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
