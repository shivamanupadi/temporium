import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  DollarSign,
  Loader2,
  Clock,
  AlertTriangle,
  Wallet,
  StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressInput } from '@/components/AddressInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { formatAddress, formatAmount, parseAmount, isValidAddress, cn } from '@/lib/utils';
import { SCHEDULE_PRESETS } from '@/lib/constants';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { saveScheduledTransaction } from '@/lib/scheduled-storage';
import type { Address } from 'viem';
import { getTokenColors, type Token } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/send')({
  component: SendPage,
});

type ModalState = 'confirm' | 'pending' | 'success' | null;

function SendPage(): ReactElement | null {
  const { address, sendPayment, sendScheduledPayment } = useTempo();
  const navigate = useNavigate();
  const { tokens, isLoading: tokensLoading } = useTokenList();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleSeconds, setScheduleSeconds] = useState(SCHEDULE_PRESETS[0].seconds);
  const [scheduledForTimestamp, setScheduledForTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      const defaultToken = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0];
      setSelectedToken(defaultToken);
    }
  }, [tokens, selectedToken]);

  const balance = useTokenBalance(selectedToken?.address);

  if (!address) return null;

  const parsedAmount = selectedToken ? parseAmount(amount, selectedToken.decimals) : 0n;
  const hasBalance = balance.data?.value && balance.data.value >= parsedAmount;
  const isValidForm =
    isValidAddress(recipient) && parsedAmount > 0n && hasBalance && selectedToken && feeToken;

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !selectedToken || !feeToken || !address) return;
    setModalState('pending');
    try {
      let hash: string;

      if (isScheduled) {
        // Calculate the scheduled timestamp
        const scheduledFor = Math.floor(Date.now() / 1000) + scheduleSeconds;
        setScheduledForTimestamp(scheduledFor);

        // Send scheduled payment with validAfter
        hash = await sendScheduledPayment({
          to: recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: memo || undefined,
          scheduledFor,
        });

        // Save to IndexedDB for tracking
        await saveScheduledTransaction({
          owner: address as Address,
          txHash: hash,
          from: address as Address,
          to: recipient as Address,
          amount: parsedAmount.toString(),
          token: selectedToken.address,
          tokenSymbol: selectedToken.symbol,
          tokenDecimals: selectedToken.decimals,
          feeToken: feeToken.address,
          memo: memo || undefined,
          scheduledFor,
        });
      } else {
        // Send immediate payment
        hash = await sendPayment({
          to: recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: memo || undefined,
        });
      }

      setTxHash(hash);
      setModalState('success');
    } catch (err) {
      console.error(err);
      toast.error(isScheduled ? 'Failed to schedule payment' : 'Failed to send payment');
      setModalState('confirm');
    }
  };

  const resetForm = (): void => {
    setRecipient('');
    setAmount('');
    setMemo('');
    setTxHash(null);
    setModalState(null);
    setIsScheduled(false);
    setScheduleSeconds(SCHEDULE_PRESETS[0].seconds);
    setScheduledForTimestamp(null);
  };

  const handleCloseModal = (): void => {
    if (modalState === 'success') {
      resetForm();
    } else if (modalState !== 'pending') {
      setModalState(null);
    }
  };

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Send</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-5 space-y-5 min-h-[520px]">
        {/* Token Pills */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Token
          </label>
          <div className="flex gap-1.5 overflow-x-auto min-h-[34px]">
            {tokensLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[34px] w-20 bg-muted rounded-full animate-pulse" />
                ))
              : tokens.map(token => {
                  const colors = getTokenColors(token.symbol);
                  const isSelected = selectedToken?.address === token.address;
                  return (
                    <button
                      key={token.address}
                      onClick={() => setSelectedToken(token)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.bg,
                          color: isSelected ? 'white' : colors.text,
                        }}
                      >
                        <DollarSign className="h-2.5 w-2.5" />
                      </span>
                      {token.symbol}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-light text-border">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                if (val.split('.').length <= 2) setAmount(val);
              }}
              className="w-full text-4xl font-light text-foreground bg-transparent border-none outline-none pl-7 placeholder:text-border"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px] text-muted-foreground">{selectedToken?.symbol}</span>
            <button
              onClick={() => {
                if (balance.data?.value && selectedToken) {
                  setAmount(formatAmount(balance.data.value.toString(), selectedToken.decimals));
                }
              }}
              className="text-[12px] text-primary hover:text-primary/80 transition-colors font-medium min-w-[80px] text-right"
            >
              {balance.isLoading
                ? '-.--'
                : formatAmount(balance.data?.value.toString() || '0', selectedToken?.decimals)}{' '}
              available
            </button>
          </div>
          {amount && parsedAmount > 0n && !hasBalance && (
            <p className="text-[12px] text-destructive mt-1">Insufficient balance</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Recipient */}
        <AddressInput label="Recipient" value={recipient} onChange={setRecipient} />

        {/* Memo */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Memo <span className="text-muted-foreground/60 normal-case">(optional)</span>
          </label>
          <Input
            placeholder="Add a note..."
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="text-[13px] h-10"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Schedule Toggle */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
            When to send
          </label>
          <div className="flex gap-2">
            <label
              className={cn(
                'flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                !isScheduled
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                  !isScheduled ? 'border-primary' : 'border-muted-foreground/30'
                )}
              >
                {!isScheduled && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <input
                type="radio"
                name="scheduleType"
                checked={!isScheduled}
                onChange={() => setIsScheduled(false)}
                className="sr-only"
              />
              <span
                className={cn(
                  'text-[13px] font-medium',
                  !isScheduled ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Send now
              </span>
            </label>

            <label
              className={cn(
                'flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                isScheduled
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                  isScheduled ? 'border-primary' : 'border-muted-foreground/30'
                )}
              >
                {isScheduled && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <input
                type="radio"
                name="scheduleType"
                checked={isScheduled}
                onChange={() => setIsScheduled(true)}
                className="sr-only"
              />
              <Clock
                className={cn(
                  'h-4 w-4 shrink-0',
                  isScheduled ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[13px] font-medium',
                  isScheduled ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Schedule
              </span>
            </label>
          </div>
        </div>

        {/* Schedule Time Selection */}
        {isScheduled && (
          <div className="space-y-3">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Execute in
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SCHEDULE_PRESETS.map(preset => (
                <button
                  key={preset.seconds}
                  onClick={() => setScheduleSeconds(preset.seconds)}
                  className={cn(
                    'px-4 py-2 rounded-full text-[13px] font-medium transition-all',
                    scheduleSeconds === preset.seconds
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Warning about no cancellation */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-[12px] text-warning leading-relaxed">
                Scheduled transactions cannot be cancelled once submitted. The payment will execute
                automatically at the scheduled time.
              </p>
            </div>
          </div>
        )}

        <FeeTokenSelector
          value={feeToken}
          onChange={setFeeToken}
          className="pt-2 border-t border-border/50"
        />

        {/* Submit */}
        <Button
          className="w-full h-11 text-[14px] font-medium"
          disabled={!isValidForm}
          onClick={() => setModalState('confirm')}
        >
          {isScheduled ? 'Review Scheduled Payment' : 'Review Payment'}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent
          hideClose={modalState === 'pending'}
          className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl"
        >
          {/* CONFIRM STATE */}
          {modalState === 'confirm' && selectedToken && feeToken && (
            <>
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-semibold">
                  {isScheduled ? 'Schedule Payment' : 'Confirm Payment'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Review the details before confirming
                </DialogDescription>
              </div>

              <div className="px-6 pb-6">
                {/* Amount Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(selectedToken.symbol).bg }}
                      >
                        <DollarSign
                          className="h-5 w-5"
                          style={{ color: getTokenColors(selectedToken.symbol).text }}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-lg font-semibold text-foreground">
                          {amount} {selectedToken.symbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipient Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Recipient</p>
                      <p className="font-mono text-sm text-foreground truncate">
                        {formatAddress(recipient, 10)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                {(memo || isScheduled) && (
                  <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-3">
                    {memo && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                          <StickyNote className="h-4 w-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Memo</p>
                          <p className="text-sm text-foreground mt-0.5 break-words">{memo}</p>
                        </div>
                      </div>
                    )}
                    {isScheduled && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                          <Clock className="h-4 w-4 text-sky-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Scheduled for</p>
                          <p className="text-sm text-foreground font-medium mt-0.5">
                            {new Date(Date.now() + scheduleSeconds * 1000).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setModalState(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>{isScheduled ? 'Schedule' : 'Confirm'}</Button>
              </div>
            </>
          )}

          {/* PENDING STATE */}
          {modalState === 'pending' && selectedToken && (
            <div className="relative overflow-hidden">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing your payment</DialogDescription>

              {/* Ambient background glow */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-20 -left-20 w-40 h-40 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)',
                  }}
                />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)',
                  }}
                />
              </div>

              <div className="relative px-6 py-12 text-center">
                {/* Animated icon container */}
                <div className="relative inline-flex items-center justify-center mb-6">
                  {/* Outer rotating ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute w-16 h-16"
                  >
                    <svg viewBox="0 0 64 64" className="w-full h-full">
                      <circle
                        cx="32"
                        cy="32"
                        r="30"
                        fill="none"
                        stroke="url(#pendingGradient)"
                        strokeWidth="1.5"
                        strokeDasharray="50 140"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="pendingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(52,211,153,0.7)" />
                          <stop offset="100%" stopColor="rgba(52,211,153,0.1)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </motion.div>

                  {/* Inner pulsing circle */}
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-emerald-50"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-5 h-5 text-emerald-500" />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {isScheduled ? 'Scheduling' : 'Sending'}
                  </p>
                  <p className="text-[32px] font-semibold text-foreground tracking-tight leading-none">
                    {amount}
                    <span className="text-[20px] font-medium text-muted-foreground ml-2">
                      {selectedToken.symbol}
                    </span>
                  </p>
                </motion.div>

                {/* Recipient */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60"
                >
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {formatAddress(recipient, 6)}
                  </span>
                </motion.div>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {modalState === 'success' && txHash && selectedToken && (
            <div className="relative overflow-hidden bg-white">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Payment completed</DialogDescription>

              <div className="relative px-6 pt-10 pb-8 text-center">
                {/* Animated success icon */}
                <div className="relative inline-flex items-center justify-center mb-8">
                  {/* Circle container */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    {/* Animated checkmark SVG */}
                    <svg
                      width="28"
                      height="28"
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
                  </motion.div>
                </div>

                {/* Success text */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="text-foreground text-sm font-semibold mb-1"
                >
                  {isScheduled ? 'Payment Scheduled' : 'Payment Successful'}
                </motion.p>

                {/* Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="mb-6"
                >
                  <span className="text-3xl font-semibold text-foreground">{amount}</span>
                  <span className="text-lg text-muted-foreground ml-1.5">
                    {selectedToken.symbol}
                  </span>
                </motion.div>

                {/* Details card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-3 text-left"
                >
                  {/* Recipient */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">To</span>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-foreground">
                        {formatAddress(recipient, 8)}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled time */}
                  {isScheduled && scheduledForTimestamp && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Executes</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span className="text-xs font-medium text-foreground">
                          {new Date(scheduledForTimestamp * 1000).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Transaction hash */}
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
                </motion.div>
              </div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="px-6 pb-6 flex items-center gap-2"
              >
                {isScheduled && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate({ to: '/portal/scheduled' })}
                  >
                    View Scheduled
                  </Button>
                )}
                <Button className="flex-1" onClick={resetForm}>
                  Done
                </Button>
              </motion.div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
