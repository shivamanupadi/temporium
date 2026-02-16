import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef, useMemo, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Clock,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  CalendarCheck,
  CalendarIcon,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { useTempo, useTokenBalance, encodeMemo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { createScheduledTransaction } from '@/lib/scheduled-transactions';
import type { Token } from '@/lib/tokenlist';
import { SCHEDULE_PRESETS } from '@/lib/constants';
import { tempoChain } from '@/lib/tempo-client';
import {
  formatAmount,
  parseAmount,
  formatAddress,
  isValidAddress,
  copyToClipboard,
  cn,
} from '@/lib/utils';
import { getExplorerTxUrl, waitForTx } from '@/lib/tempo-client';

interface SendSearchParams {
  mode?: SendMode;
}

export const Route = createFileRoute('/portal/send')({
  component: SendPage,
  validateSearch: (search: Record<string, unknown>): SendSearchParams => ({
    mode:
      search.mode === 'scheduled' ? 'scheduled' : search.mode === 'instant' ? 'instant' : undefined,
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SendMode = 'instant' | 'scheduled';
type FlowStep = 'form' | 'confirm' | 'sending' | 'success';

interface FormState {
  recipient: string;
  amount: string;
  memo: string;
}

const EMPTY_FORM: FormState = { recipient: '', amount: '', memo: '' };

function formatDuration(seconds: number): string {
  const units: [string, number][] = [
    ['d', 86400],
    ['hr', 3600],
    ['min', 60],
    ['sec', 1],
  ];
  const parts: string[] = [];
  let remaining = seconds;
  for (const [label, size] of units) {
    if (remaining >= size) {
      const count = Math.floor(remaining / size);
      parts.push(`${count} ${label}`);
      remaining -= count * size;
    }
    if (parts.length === 2) break;
  }
  return parts.length > 0 ? parts.join(' ') : '0 sec';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SendPage(): ReactElement | null {
  const { mode: searchMode } = Route.useSearch();
  const navigate = useNavigate();
  const { address, isConnected, sendPayment, signScheduledPayment } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  // Token selection state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Default to first token when tokens load
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) setSelectedToken(tokens[0]);
  }, [tokens, selectedToken]);

  // Fee token priority: user on-chain preference > chain default (AlphaUSD) > first token
  useEffect(() => {
    if (tokens.length === 0 || feeToken) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, feeToken, preferredFeeToken]);

  const balance = useTokenBalance(selectedToken?.address, address);

  // Form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const mode: SendMode = searchMode ?? 'instant';
  const setMode = useCallback(
    (next: SendMode) => {
      navigate({
        to: '/portal/send',
        search: { mode: next === 'instant' ? undefined : next },
        replace: true,
      } as any);
    },
    [navigate]
  );
  const [scheduleSeconds, setScheduleSeconds] = useState<number | null>(
    SCHEDULE_PRESETS[0].seconds
  );

  // Custom date/time picker state (combined)
  const [customDateTime, setCustomDateTime] = useState<Date | undefined>(undefined);

  // Flow state
  const [step, setStep] = useState<FlowStep>('form');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scheduled payment state
  const [scheduledForTime, setScheduledForTime] = useState<string | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tokenDecimals = selectedToken?.decimals ?? 6;
  const parsedAmount = parseAmount(form.amount, tokenDecimals);
  const hasValidRecipient = isValidAddress(form.recipient);
  const hasValidAmount = parsedAmount > 0n;
  const hasSufficientBalance = !balance.isLoading && balance.data.value >= parsedAmount;

  // Compute the custom datetime timestamp (if user picked a custom date/time)
  const customTimestamp = useMemo(() => {
    if (!customDateTime) return null;
    const ts = Math.floor(customDateTime.getTime() / 1000);
    return ts > Math.floor(Date.now() / 1000) ? ts : null;
  }, [customDateTime]);

  const isCustomMode = scheduleSeconds === null;
  const hasValidSchedule = isCustomMode ? customTimestamp !== null : scheduleSeconds !== null;

  const isFormValid =
    hasValidRecipient &&
    hasValidAmount &&
    hasSufficientBalance &&
    (mode === 'instant' || hasValidSchedule);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAmountChange = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      // Prevent multiple dots
      if (cleaned.split('.').length > 2) return;
      // Limit decimal places to 6
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length > 6) return;
      updateField('amount', cleaned);
    },
    [updateField]
  );

  const handleMaxAmount = useCallback(() => {
    if (!balance.isLoading && balance.data.value > 0n) {
      updateField('amount', formatAmount(balance.data.value, tokenDecimals, tokenDecimals));
    }
  }, [balance, updateField, tokenDecimals]);

  const handleReview = useCallback(() => {
    if (!isFormValid) return;
    setStep('confirm');
  }, [isFormValid]);

  const handleConfirmSend = useCallback(async () => {
    if (!isFormValid || !address || !selectedToken || !feeToken) return;
    setStep('sending');

    try {
      if (mode === 'scheduled') {
        const scheduledFor = isCustomMode
          ? customTimestamp!
          : Math.floor(Date.now() / 1000) + scheduleSeconds!;

        if (scheduledFor <= Math.floor(Date.now() / 1000)) {
          throw new Error('Scheduled time must be in the future');
        }

        // Sign the transaction now
        const { serializedTransaction } = await signScheduledPayment({
          to: form.recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: form.memo ? encodeMemo(form.memo) : undefined,
          scheduledFor,
        });

        // POST to worker API — the cron will submit it when the time comes
        const scheduledForISO = new Date(scheduledFor * 1000).toISOString();
        await createScheduledTransaction({
          serializedTx: serializedTransaction,
          from: address,
          to: form.recipient,
          amount: parsedAmount.toString(),
          token: selectedToken.address,
          tokenSymbol: selectedToken.symbol,
          tokenDecimals: selectedToken.decimals,
          feeToken: feeToken.address,
          memo: form.memo || undefined,
          scheduledFor: scheduledForISO,
        });

        setScheduledForTime(
          new Date(scheduledFor * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setStep('success');
        toast.success('Payment scheduled successfully');
      } else {
        const hash = await sendPayment({
          to: form.recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: form.memo ? encodeMemo(form.memo) : undefined,
        });

        await waitForTx(hash as `0x${string}`);
        setTxHash(hash);
        setStep('success');
        toast.success('Payment sent');
      }
    } catch (err) {
      console.error('Send failed:', err);
      const message = err instanceof Error ? err.message : 'Transaction failed';
      toast.error(message);
      setStep('confirm');
    }
  }, [
    isFormValid,
    address,
    selectedToken,
    feeToken,
    mode,
    scheduleSeconds,
    isCustomMode,
    customTimestamp,
    signScheduledPayment,
    sendPayment,
    form,
    parsedAmount,
  ]);

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
    setForm(EMPTY_FORM);
    setMode('instant');
    setScheduleSeconds(SCHEDULE_PRESETS[0].seconds);
    setCustomDateTime(undefined);
    setStep('form');
    setTxHash(null);
    setCopied(false);
    setScheduledForTime(null);
  }, [setMode]);

  const handleDialogClose = useCallback(() => {
    if (step === 'sending') return; // prevent closing during tx
    if (step === 'success') {
      resetForm();
    } else {
      setStep('form');
    }
  }, [step, resetForm]);

  // ---------------------------------------------------------------------------
  // Guard
  // ---------------------------------------------------------------------------

  if (!isConnected || !address || !selectedToken || !feeToken) return null;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const balanceDisplay = balance.isLoading
    ? '...'
    : formatAmount(balance.data.value, tokenDecimals, 2);

  const formattedParsedAmount =
    parsedAmount > 0n ? formatAmount(parsedAmount, tokenDecimals, 2) : '0.00';

  return (
    <div className="max-w-lg">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Send Payment</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Transfer tokens instantly or schedule for later
        </p>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm"
      >
        {/* Tabs: Instant / Scheduled */}
        <div className="p-5 pb-0">
          <Tabs
            value={mode}
            onValueChange={(v: string) => setMode(v as SendMode)}
            className="w-full"
          >
            <TabsList className="w-full bg-[#F5F2ED] h-10 rounded-xl p-1">
              <TabsTrigger
                value="instant"
                className="flex-1 rounded-lg text-[13px] font-medium data-[state=active]:bg-white data-[state=active]:text-[#2D3436] data-[state=active]:shadow-sm text-[#9B9590]"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Instant
              </TabsTrigger>
              <TabsTrigger
                value="scheduled"
                className="flex-1 rounded-lg text-[13px] font-medium data-[state=active]:bg-white data-[state=active]:text-[#2D3436] data-[state=active]:shadow-sm text-[#9B9590]"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Scheduled
              </TabsTrigger>
            </TabsList>

            {/* Shared form content (rendered outside TabsContent for both tabs) */}
            <TabsContent value="instant" className="mt-0" />
            <TabsContent value="scheduled" className="mt-0" />
          </Tabs>
        </div>

        <div className="p-5 space-y-5">
          {/* Recipient address */}
          <ContactPicker
            value={form.recipient}
            onChange={v => updateField('recipient', v)}
            selfAddress={address}
          />

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Amount
              </label>
              <button
                type="button"
                onClick={handleMaxAmount}
                className="text-[11px] font-medium text-[#E07A5F] hover:text-[#E07A5F]/80 transition-colors"
              >
                Balance: {balanceDisplay} {selectedToken.symbol}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleAmountChange(e.target.value)
                  }
                  className={cn(
                    'text-[18px] font-semibold h-12 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]/20 transition-all',
                    form.amount &&
                      hasValidAmount &&
                      !hasSufficientBalance &&
                      'border-red-300 bg-red-50/30'
                  )}
                />
              </div>
              <TokenPicker
                token={selectedToken}
                tokens={tokens}
                onChange={setSelectedToken}
                accentColor="#E07A5F"
              />
            </div>
            {form.amount && hasValidAmount && !hasSufficientBalance && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                Insufficient balance
              </motion.p>
            )}
          </div>

          {/* Memo */}
          <div>
            <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
              Memo{' '}
              <span className="text-[#B5B0AA] font-normal normal-case">
                (optional, max 32 bytes)
              </span>
            </label>
            <Input
              placeholder="What's this for?"
              value={form.memo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('memo', e.target.value)
              }
              maxLength={32}
              className="text-[13px] h-10 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]/20 transition-all"
            />
          </div>

          {/* Fee token */}
          <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />

          {/* Schedule presets (visible only in scheduled mode) */}
          <AnimatePresence mode="wait">
            {mode === 'scheduled' && (
              <motion.div
                key="schedule-options"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Quick presets */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider block">
                      Quick delay
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {SCHEDULE_PRESETS.map(
                        (preset: { readonly label: string; readonly seconds: number }) => {
                          const isActive = scheduleSeconds === preset.seconds;
                          return (
                            <button
                              key={preset.seconds}
                              type="button"
                              onClick={() => {
                                setScheduleSeconds(preset.seconds);
                                setCustomDateTime(new Date(Date.now() + preset.seconds * 1000));
                              }}
                              className={cn(
                                'px-4 py-2 rounded-xl text-[13px] font-medium transition-all border',
                                isActive
                                  ? 'bg-[#9B72CF] text-white border-[#9B72CF] shadow-sm'
                                  : 'bg-[#FDFBF8] text-[#6B6560] border-[#EDE9E3] hover:border-[#9B72CF]/40 hover:bg-[#9B72CF]/5'
                              )}
                            >
                              <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                              {preset.label}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-[#EDE9E3]" />
                    <span className="text-[11px] font-medium text-[#B5B0AA] uppercase">or</span>
                    <div className="flex-1 border-t border-[#EDE9E3]" />
                  </div>

                  {/* Custom date & time picker */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider block">
                      Pick a date & time
                    </label>
                    <DateTimePicker
                      date={customDateTime}
                      onDateChange={d => {
                        setCustomDateTime(d);
                        setScheduleSeconds(null);
                      }}
                      color="lavender"
                      placeholder="Select date & time"
                      disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                    {isCustomMode && customTimestamp && (
                      <p className="text-[12px] text-[#9B72CF] font-medium">
                        {format(new Date(customTimestamp * 1000), "EEEE, MMM d 'at' h:mm a")}
                      </p>
                    )}
                    {isCustomMode && customDateTime && !customTimestamp && (
                      <p className="text-[12px] text-coral/70">Selected time is in the past</p>
                    )}
                  </div>

                  {/* Warning banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-coral/[0.04] border border-coral/15">
                    <AlertTriangle className="w-4 h-4 text-coral/60 mt-0.5 shrink-0" />
                    <p className="text-[12px] text-coral/70 leading-relaxed">
                      The transaction will be signed now and submitted automatically at the
                      scheduled time. You can cancel pending payments from the Scheduled page.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="border-t border-[#EDE9E3]" />

          {/* Submit button */}
          <Button
            disabled={!isFormValid}
            onClick={handleReview}
            className={cn(
              'w-full h-12 rounded-xl text-[14px] font-semibold transition-all',
              mode === 'instant'
                ? 'bg-[#E07A5F] hover:bg-[#D4694F] text-white'
                : 'bg-[#9B72CF] hover:bg-[#8A62BE] text-white'
            )}
          >
            {mode === 'instant' ? 'Review Payment' : 'Review Scheduled Payment'}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </motion.div>

      {/* ================================================================= */}
      {/* Confirmation / Sending / Success Dialog                            */}
      {/* ================================================================= */}
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
            {/* ─── Confirm Step ───────────────────────────────────── */}
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
                    {mode === 'instant' ? 'Confirm Payment' : 'Confirm Scheduled Payment'}
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                    Review the details before sending
                  </DialogDescription>
                </div>

                <div className="px-6 pb-4 space-y-3">
                  {/* Amount card */}
                  <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                      Amount
                    </p>
                    <p className="text-2xl font-bold text-[#2D3436]">
                      {formattedParsedAmount}{' '}
                      <span className="text-[15px] font-semibold text-[#9B9590]">
                        {selectedToken.symbol}
                      </span>
                    </p>
                  </div>

                  {/* Recipient card */}
                  <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                      Recipient
                    </p>
                    <p className="font-mono text-[13px] text-[#2D3436] break-all">
                      {form.recipient}
                    </p>
                  </div>

                  {/* Memo (if present) */}
                  {form.memo && (
                    <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                      <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                        Memo
                      </p>
                      <p className="text-[13px] text-[#2D3436] break-words">{form.memo}</p>
                    </div>
                  )}

                  {/* Schedule info */}
                  {mode === 'scheduled' && (
                    <div className="bg-[#9B72CF]/5 rounded-xl p-4 border border-[#9B72CF]/15">
                      <div className="flex items-center gap-2">
                        {isCustomMode ? (
                          <CalendarIcon className="w-4 h-4 text-[#9B72CF]" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#9B72CF]" />
                        )}
                        <div>
                          <p className="text-[11px] font-semibold text-[#9B72CF] uppercase tracking-wider">
                            Scheduled Delivery
                          </p>
                          <p className="text-[13px] font-medium text-[#2D3436] mt-0.5">
                            {isCustomMode && customTimestamp ? (
                              format(new Date(customTimestamp * 1000), "EEEE, MMM d 'at' h:mm a")
                            ) : (
                              <>
                                In {formatDuration(scheduleSeconds!)} &middot;{' '}
                                {new Date(Date.now() + scheduleSeconds! * 1000).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
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
                    className={cn(
                      'flex-1 h-11 rounded-xl font-semibold',
                      mode === 'instant'
                        ? 'bg-[#E07A5F] hover:bg-[#D4694F] text-white'
                        : 'bg-[#9B72CF] hover:bg-[#8A62BE] text-white'
                    )}
                  >
                    {mode === 'instant' ? 'Send Now' : 'Schedule Payment'}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ─── Sending Step ───────────────────────────────────── */}
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
                  Your payment is being processed
                </DialogDescription>

                {/* Background glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <motion.div
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.15, 0.3, 0.15],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute -top-16 -left-16 w-48 h-48 rounded-full"
                    style={{
                      background:
                        mode === 'instant'
                          ? 'radial-gradient(circle, rgba(224,122,95,0.2) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(155,114,207,0.2) 0%, transparent 70%)',
                    }}
                  />
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.1, 0.25, 0.1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.5,
                    }}
                    className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full"
                    style={{
                      background:
                        mode === 'instant'
                          ? 'radial-gradient(circle, rgba(224,122,95,0.15) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(155,114,207,0.15) 0%, transparent 70%)',
                    }}
                  />
                </div>

                <div className="relative px-6 py-14 text-center">
                  {/* Spinner */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="absolute w-16 h-16"
                    >
                      <svg viewBox="0 0 64 64" className="w-full h-full">
                        <circle
                          cx="32"
                          cy="32"
                          r="30"
                          fill="none"
                          stroke={
                            mode === 'instant' ? 'rgba(224,122,95,0.5)' : 'rgba(155,114,207,0.5)'
                          }
                          strokeWidth="1.5"
                          strokeDasharray="50 140"
                          strokeLinecap="round"
                        />
                      </svg>
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center',
                        mode === 'instant' ? 'bg-[#E07A5F]/10' : 'bg-[#9B72CF]/10'
                      )}
                    >
                      <Loader2
                        className={cn(
                          'w-5 h-5 animate-spin',
                          mode === 'instant' ? 'text-[#E07A5F]' : 'text-[#9B72CF]'
                        )}
                      />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                      {mode === 'instant' ? 'Sending Payment' : 'Scheduling Payment'}
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {formattedParsedAmount}
                      <span className="text-lg font-semibold text-[#9B9590] ml-2">
                        {selectedToken.symbol}
                      </span>
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F2ED]"
                  >
                    <span className="font-mono text-[11px] text-[#6B6560]">
                      {formatAddress(form.recipient, 6)}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ─── Success Step ──────────────────────────────────── */}
            {step === 'success' && (mode === 'scheduled' || txHash) && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">
                  {mode === 'instant' ? 'Payment Successful' : 'Payment Scheduled'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {mode === 'instant'
                    ? 'Your payment has been completed'
                    : 'Your payment has been scheduled and will execute automatically'}
                </DialogDescription>

                <div className="px-6 pt-10 pb-6 text-center">
                  {/* Success icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                    }}
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
                          transition={{
                            duration: 0.4,
                            delay: 0.3,
                            ease: 'easeOut',
                          }}
                        />
                      </svg>
                    </div>
                  </motion.div>

                  {/* Title */}
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-[15px] font-bold text-[#2D3436] mb-1"
                  >
                    {mode === 'instant' ? 'Payment Sent' : 'Payment Scheduled'}
                  </motion.p>

                  {/* Amount */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mb-6"
                  >
                    <span className="text-3xl font-bold text-[#2D3436]">
                      {formattedParsedAmount}
                    </span>
                    <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                      {selectedToken.symbol}
                    </span>
                  </motion.div>

                  {/* Details */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left"
                  >
                    {/* Recipient */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        To
                      </span>
                      <span className="font-mono text-[12px] text-[#2D3436]">
                        {formatAddress(form.recipient, 8)}
                      </span>
                    </div>

                    {/* Memo */}
                    {form.memo && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                          Memo
                        </span>
                        <span className="text-[12px] text-[#2D3436] max-w-[200px] truncate">
                          {form.memo}
                        </span>
                      </div>
                    )}

                    {/* Scheduled delivery time */}
                    {mode === 'scheduled' && scheduledForTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                          Will execute at
                        </span>
                        <span className="text-[12px] font-medium text-[#9B72CF] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {scheduledForTime}
                        </span>
                      </div>
                    )}

                    {/* Tx hash (instant only) */}
                    {txHash && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
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
                            title="Copy transaction hash"
                          >
                            {copied ? (
                              <Check className="w-3 h-3 text-[#5B9A6F]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#9B9590]" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Footer actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="px-6 pb-6 flex gap-3"
                >
                  {mode === 'instant' && txHash ? (
                    <Button
                      variant="outline"
                      onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                      className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Explorer
                    </Button>
                  ) : (
                    <Link to="/portal/scheduled" className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                        View Scheduled
                      </Button>
                    </Link>
                  )}
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
