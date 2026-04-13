import { type ReactElement, useState, useEffect, useCallback, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react';
import type { Address } from 'viem';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { useTempo, useTokenBalance, encodeMemo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { createScheduledTransaction, getScheduledTxConfig } from '@/lib/scheduled-transactions';
import { createMppxFetch } from '@/lib/mpp';
import type { Token } from '@/lib/tokenlist';
import { tempoChain } from '@/lib/tempo-client';
import { SCHEDULE_PRESETS } from '@/lib/constants';
import { parseAmount, isValidAddress, cn } from '@/lib/utils';
import {
  getScheduledTransactions,
  deleteScheduledTransaction,
  type PaginatedScheduledTxResponse,
} from '@/lib/scheduled-transactions';
import { formatAmount, formatAddress, formatCountdown, formatTimeAgo } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import type { ScheduledTransaction } from '@/types';

interface ScheduledSearchParams {
  filter?: StatusFilter;
}

export const Route = createFileRoute('/portal/scheduled-payments')({
  component: ScheduledPage,
  validateSearch: (search: Record<string, unknown>): ScheduledSearchParams => {
    const f = search.filter;
    return {
      filter: f === 'all' || f === 'pending' || f === 'executed' || f === 'failed' ? f : undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Status filter
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'pending' | 'executed' | 'failed';

const FILTERS: { key: StatusFilter; label: string; icon?: typeof Clock }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'executed', label: 'Executed', icon: CheckCircle },
  { key: 'failed', label: 'Failed', icon: XCircle },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ScheduledPage(): ReactElement {
  const { filter: searchFilter } = Route.useSearch();
  const navigate = useNavigate();
  const filter: StatusFilter = searchFilter ?? 'pending';
  const setFilter = useCallback(
    (next: StatusFilter) => {
      navigate({
        to: '/portal/scheduled-payments',
        search: { filter: next === 'pending' ? undefined : next },
        replace: true,
      } as any);
    },
    [navigate]
  );

  const [showNewModal, setShowNewModal] = useState(false);
  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [, setTick] = useState(0);

  const fetchTransactions = useCallback(
    async (cursor?: string): Promise<void> => {
      try {
        const res: PaginatedScheduledTxResponse = await getScheduledTransactions({
          status: filter === 'all' ? undefined : filter,
          cursor,
          limit: PAGE_SIZE,
        });
        if (cursor) {
          setTransactions(prev => [...prev, ...res.items]);
        } else {
          setTransactions(res.items);
        }
        setNextCursor(res.nextCursor);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filter]
  );

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await fetchTransactions();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = (): void => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    fetchTransactions(nextCursor);
  };

  // Reset and fetch when filter changes
  useEffect(() => {
    setIsLoading(true);
    setTransactions([]);
    setNextCursor(null);
    fetchTransactions();
  }, [fetchTransactions]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => fetchTransactions(), TIMING.SCHEDULED_TX_CHECK_MS);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // Countdown tick for pending txs
  const hasPending = transactions.some(tx => tx.status === 'pending');
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => setTick(t => t + 1), TIMING.COUNTDOWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPending]);

  const handleCancelled = (): void => {
    fetchTransactions();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between shrink-0"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Scheduled Payments</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Manage your time-locked and scheduled transfers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button
            onClick={() => setShowNewModal(true)}
            className="h-10 px-5 text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            New Transfer
          </Button>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-[#F5F2ED] rounded-lg shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
              filter === f.key
                ? 'bg-white text-[#2D3436] shadow-sm'
                : 'text-[#9B9590] hover:text-[#6B6560]'
            }`}
          >
            {f.icon && <f.icon className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
        {isLoading ? (
          <div className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#9B9590] mx-auto" />
          </div>
        ) : error ? (
          <div className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm">
            <div className="px-6 py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-coral/8 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-7 w-7 text-coral" />
              </div>
              <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">
                Failed to load transactions
              </h2>
              <p className="text-[13px] text-[#6B6560] max-w-[280px] mx-auto leading-relaxed mb-4">
                {error}
              </p>
              <Button
                onClick={() => fetchTransactions()}
                variant="outline"
                className="h-9 px-4 rounded-xl text-[13px] font-semibold border-[#EDE9E3]"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-[#B5B0AA]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#2D3436]">
              {filter === 'all'
                ? 'No Scheduled Payments'
                : `No ${FILTERS.find(f => f.key === filter)?.label} Transactions`}
            </h3>
            <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
              {filter === 'all'
                ? 'Schedule a transfer to send tokens at a specific time in the future.'
                : 'No transactions match this filter.'}
            </p>
            {filter === 'all' && (
              <Button
                onClick={() => setShowNewModal(true)}
                className="mt-5 h-10 px-6 text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15 gap-2"
              >
                <Send className="w-4 h-4" />
                Schedule a Transfer
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: index < PAGE_SIZE ? index * 0.03 : 0, duration: 0.2 }}
                >
                  <TransactionRow transaction={tx} onCancelled={handleCancelled} />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Load more */}
            {nextCursor && (
              <div className="pt-2 pb-2 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="h-9 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Scheduled Payment Modal */}
      <ScheduledSendModal
        open={showNewModal}
        onOpenChange={open => {
          setShowNewModal(open);
          if (!open) fetchTransactions();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scheduled Send Modal
// ---------------------------------------------------------------------------

function ScheduledSendModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { address, walletClient, signScheduledPayment } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [scheduleSeconds, setScheduleSeconds] = useState<number | null>(
    SCHEDULE_PRESETS[0].seconds
  );
  const [customDateTime, setCustomDateTime] = useState<Date | undefined>(undefined);
  const [step, setStep] = useState<'form' | 'confirm' | 'pay-fee' | 'sending' | 'success'>('form');
  const [sendingPhase, setSendingPhase] = useState<'signing' | 'paying-fee' | 'saving'>('signing');
  const [scheduledForTime, setScheduledForTime] = useState<string | null>(null);
  const [signedTx, setSignedTx] = useState<string | null>(null);
  const [signedScheduledFor, setSignedScheduledFor] = useState<number | null>(null);

  // Platform service fee (flat, in token decimal units e.g. "0.1")
  const [feeAmount, setFeeAmount] = useState('0');
  useEffect(() => {
    getScheduledTxConfig()
      .then(cfg => setFeeAmount(cfg.feeAmount))
      .catch(() => setFeeAmount('0'));
  }, []);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) setSelectedToken(tokens[0]);
  }, [tokens, selectedToken]);

  useEffect(() => {
    if (tokens.length === 0 || feeToken) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, preferredFeeToken, feeToken]);

  const balance = useTokenBalance(selectedToken?.address, address);
  const tokenDecimals = selectedToken?.decimals ?? 6;
  const parsedAmount = parseAmount(amount, tokenDecimals);
  const hasValidRecipient = isValidAddress(recipient);
  const hasValidAmount = parsedAmount > 0n;
  const hasSufficientBalance = !balance.isLoading && balance.data.value >= parsedAmount;

  const isCustomMode = scheduleSeconds === null;
  const customTimestamp = useMemo(() => {
    if (!customDateTime) return null;
    const ts = Math.floor(customDateTime.getTime() / 1000);
    return ts > Math.floor(Date.now() / 1000) ? ts : null;
  }, [customDateTime]);
  const hasValidSchedule = isCustomMode ? customTimestamp !== null : scheduleSeconds !== null;

  const hasFee = feeAmount !== '0';

  const isFormValid =
    hasValidRecipient && hasValidAmount && hasSufficientBalance && hasValidSchedule;

  const balanceDisplay = balance.isLoading
    ? '...'
    : formatAmount(balance.data.value, tokenDecimals);

  const formattedAmount = parsedAmount > 0n ? formatAmount(parsedAmount, tokenDecimals) : '0.00';

  const resetForm = useCallback(() => {
    setRecipient('');
    setAmount('');
    setMemo('');
    setScheduleSeconds(SCHEDULE_PRESETS[0].seconds);
    setCustomDateTime(undefined);
    setStep('form');
  }, []);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  // Shared: submit the signed tx to the API via mppx fetch
  const saveScheduledTx = useCallback(
    async (serializedTransaction: string, scheduledFor: number) => {
      if (!address || !selectedToken || !feeToken) return;
      setSendingPhase('saving');

      const mppxFetch = createMppxFetch(walletClient) ?? fetch;

      await createScheduledTransaction(
        {
          serializedTx: serializedTransaction,
          from: address,
          to: recipient,
          amount: parsedAmount.toString(),
          token: selectedToken.address,
          tokenSymbol: selectedToken.symbol,
          tokenDecimals: selectedToken.decimals,
          feeToken: feeToken.address,
          memo: memo || undefined,
          scheduledFor: new Date(scheduledFor * 1000).toISOString(),
        },
        mppxFetch
      );

      setScheduledForTime(
        new Date(scheduledFor * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setStep('success');
    },
    [address, selectedToken, feeToken, walletClient, recipient, parsedAmount, memo]
  );

  // Step 1: Sign the scheduled transaction (user click → wallet popup)
  const handleSign = useCallback(async () => {
    if (!isFormValid || !address || !selectedToken || !feeToken) return;
    setSendingPhase('signing');
    setStep('sending');

    try {
      const scheduledFor = isCustomMode
        ? customTimestamp!
        : Math.floor(Date.now() / 1000) + scheduleSeconds!;

      const { serializedTransaction } = await signScheduledPayment({
        to: recipient as Address,
        amount: parsedAmount,
        token: selectedToken.address,
        feeToken: feeToken.address,
        memo: memo ? encodeMemo(memo) : undefined,
        scheduledFor,
      });

      setSignedTx(serializedTransaction);
      setSignedScheduledFor(scheduledFor);

      // If there's a fee, show the pay-fee step so the user clicks to
      // trigger the mppx popup (browsers require a direct user gesture).
      // If no fee, go straight to saving.
      if (hasFee) {
        setStep('pay-fee');
      } else {
        await saveScheduledTx(serializedTransaction, scheduledFor);
      }
    } catch (err) {
      console.error('Sign failed:', err);
      setStep('confirm');
    }
  }, [
    isFormValid,
    address,
    selectedToken,
    feeToken,
    hasFee,
    recipient,
    parsedAmount,
    memo,
    isCustomMode,
    customTimestamp,
    scheduleSeconds,
    signScheduledPayment,
    saveScheduledTx,
  ]);

  // Step 2: Pay the fee via mppx + save (user click → wallet popup for fee)
  const handlePayAndSave = useCallback(async () => {
    if (!signedTx || !signedScheduledFor) return;
    setSendingPhase('paying-fee');
    setStep('sending');

    try {
      await saveScheduledTx(signedTx, signedScheduledFor);
    } catch (err) {
      console.error('Pay & save failed:', err);
      setStep('pay-fee');
    }
  }, [signedTx, signedScheduledFor, saveScheduledTx]);

  if (!selectedToken || !feeToken) return <></>;

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (step !== 'sending') onOpenChange(o);
      }}
    >
      <DialogContent
        hideClose={step === 'sending' || step === 'pay-fee'}
        className="sm:max-w-[440px] p-0 gap-0 rounded-2xl"
      >
        <AnimatePresence mode="wait">
          {/* ─── Form ─── */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-bold text-[#2D3436]">
                  Schedule Payment
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                  Sign now, send later
                </DialogDescription>
              </div>

              <div className="px-6 pb-5 space-y-5">
                <ContactPicker value={recipient} onChange={setRecipient} selfAddress={address} />

                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="text-[18px] font-semibold bg-[#FDFBF8] flex-1"
                    />
                    <TokenPicker
                      token={selectedToken}
                      tokens={tokens}
                      onChange={setSelectedToken}
                    />
                  </div>
                  <p className="text-[12px] text-[#9B9590] mt-2">
                    Available <span className="font-semibold text-[#2D3436]">{balanceDisplay}</span>{' '}
                    {selectedToken.symbol}
                  </p>
                  {amount && hasValidAmount && !hasSufficientBalance && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Insufficient balance
                    </p>
                  )}
                </div>

                {/* Schedule presets */}
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Quick delay
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SCHEDULE_PRESETS.map(preset => {
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
                            'px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all border',
                            isActive
                              ? 'bg-[#E07A5F] text-white border-[#E07A5F] shadow-sm'
                              : 'bg-[#FDFBF8] text-[#6B6560] border-[#EDE9E3] hover:border-[#D5D0C9]'
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 border-t border-[#EDE9E3]" />
                    <span className="text-[11px] font-medium text-[#B5B0AA] uppercase">or</span>
                    <div className="flex-1 border-t border-[#EDE9E3]" />
                  </div>

                  <DateTimePicker
                    date={customDateTime}
                    onDateChange={d => {
                      setCustomDateTime(d);
                      setScheduleSeconds(null);
                    }}
                    color="coral"
                    placeholder="Pick a date & time"
                    disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                  {isCustomMode && customDateTime && !customTimestamp && (
                    <p className="text-[12px] text-red-500 mt-1">Selected time is in the past</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Memo <span className="text-[#B5B0AA] font-normal normal-case">(optional)</span>
                  </label>
                  <Input
                    placeholder="What's this for?"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    maxLength={32}
                    className="text-[13px] bg-[#FDFBF8]"
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-12 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!isFormValid}
                  onClick={() => setStep('confirm')}
                  className="flex-1 h-12 font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15"
                >
                  Review
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Confirm ─── */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-bold text-[#2D3436]">Confirm</DialogTitle>
                <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                  Review before signing
                </DialogDescription>
              </div>

              <div className="px-6 pb-4 space-y-3">
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                    Amount
                  </p>
                  <p className="text-2xl font-bold text-[#2D3436]">
                    {formattedAmount}{' '}
                    <span className="text-[15px] font-semibold text-[#9B9590]">
                      {selectedToken.symbol}
                    </span>
                  </p>
                </div>
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                    Recipient
                  </p>
                  <p className="font-mono text-[13px] text-[#2D3436] break-all">{recipient}</p>
                </div>
                <div className="bg-[#E07A5F]/5 rounded-xl p-4 border border-[#E07A5F]/15">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#E07A5F]" />
                    <div>
                      <p className="text-[11px] font-semibold text-[#E07A5F] uppercase tracking-wider">
                        Scheduled
                      </p>
                      <p className="text-[13px] font-medium text-[#2D3436] mt-0.5">
                        {isCustomMode && customTimestamp
                          ? format(new Date(customTimestamp * 1000), "EEEE, MMM d 'at' h:mm a")
                          : `In ${SCHEDULE_PRESETS.find(p => p.seconds === scheduleSeconds)?.label ?? ''}`}
                      </p>
                    </div>
                  </div>
                </div>
                {hasFee && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#9B72CF]/5 border border-[#9B72CF]/15">
                    <span className="text-[12px] text-[#9B9590]">Service fee</span>
                    <span className="text-[13px] font-semibold text-[#2D3436]">
                      {feeAmount} {selectedToken.symbol}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
                  <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                  <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1 h-12 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSign}
                  className="flex-1 h-12 font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15"
                >
                  {hasFee ? 'Sign & Continue' : 'Schedule Payment'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Pay Fee ─── */}
          {step === 'pay-fee' && (
            <motion.div
              key="pay-fee"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-bold text-[#2D3436]">
                  Pay Service Fee
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                  Transaction signed. Confirm the service fee to schedule.
                </DialogDescription>
              </div>

              <div className="px-6 pb-4 space-y-3">
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                    Payment Amount
                  </p>
                  <p className="text-2xl font-bold text-[#2D3436]">
                    {formattedAmount}{' '}
                    <span className="text-[15px] font-semibold text-[#9B9590]">
                      {selectedToken.symbol}
                    </span>
                  </p>
                </div>

                <div className="bg-[#9B72CF]/5 rounded-xl p-4 border border-[#9B72CF]/15">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-[#9B72CF] uppercase tracking-wider">
                        Service Fee
                      </p>
                      <p className="text-[12px] text-[#9B9590] mt-0.5">
                        Charged once to schedule this payment
                      </p>
                    </div>
                    <p className="text-[15px] font-bold text-[#2D3436]">
                      {feeAmount} {selectedToken.symbol}
                    </p>
                  </div>
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-[#6B8F71]" />
                    <span className="text-[12px] text-[#6B8F71] font-medium">Signed</span>
                  </div>
                  <div className="flex-1 h-px bg-[#EDE9E3]" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full border-2 border-[#9B72CF] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#9B72CF]" />
                    </div>
                    <span className="text-[12px] text-[#9B72CF] font-medium">Pay Fee</span>
                  </div>
                  <div className="flex-1 h-px bg-[#EDE9E3]" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full border-2 border-[#EDE9E3]" />
                    <span className="text-[12px] text-[#9B9590]">Schedule</span>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <Button
                  onClick={handlePayAndSave}
                  className="w-full h-12 font-semibold bg-[#9B72CF] hover:bg-[#8A63BE] text-white shadow-lg shadow-[#9B72CF]/15"
                >
                  Pay {feeAmount} {selectedToken.symbol} & Schedule
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Sending (step wizard) ─── */}
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
              <DialogDescription className="sr-only">Scheduling your payment</DialogDescription>

              {/* Background glow */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-16 -left-16 w-48 h-48 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(155,114,207,0.2) 0%, transparent 70%)',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(155,114,207,0.15) 0%, transparent 70%)',
                  }}
                />
              </div>

              <div className="relative px-6 py-14 text-center">
                {/* Spinner */}
                <div className="relative inline-flex items-center justify-center mb-6">
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
                        stroke="rgba(155,114,207,0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="50 140"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-full bg-[#9B72CF]/10 flex items-center justify-center"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-[#9B72CF]" />
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                    {sendingPhase === 'signing' && 'Signing Transaction'}
                    {sendingPhase === 'paying-fee' && 'Paying Service Fee'}
                    {sendingPhase === 'saving' && 'Scheduling Payment'}
                  </p>
                  <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                    {formattedAmount}
                    <span className="text-lg font-semibold text-[#9B9590] ml-2">
                      {selectedToken.symbol}
                    </span>
                  </p>
                </motion.div>

                {/* Step indicators */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F2ED]"
                >
                  <span className="font-mono text-[11px] text-[#6B6560]">
                    {formatAddress(recipient, 6)}
                  </span>
                </motion.div>

                <div className="flex items-center justify-center gap-2 mt-5">
                  {(['signing', ...(hasFee ? ['paying-fee'] : []), 'saving'] as const).map(
                    (phase, i) => (
                      <div key={phase} className="flex items-center gap-2">
                        {i > 0 && <div className="w-4 h-px bg-[#EDE9E3]" />}
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full transition-colors',
                            sendingPhase === phase
                              ? 'bg-[#9B72CF] scale-125'
                              : ['signing', ...(hasFee ? ['paying-fee'] : []), 'saving'].indexOf(
                                    sendingPhase
                                  ) >
                                  ['signing', ...(hasFee ? ['paying-fee'] : []), 'saving'].indexOf(
                                    phase
                                  )
                                ? 'bg-[#6B8F71]'
                                : 'bg-[#EDE9E3]'
                          )}
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Success ─── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden"
            >
              <DialogTitle className="sr-only">Scheduled</DialogTitle>
              <DialogDescription className="sr-only">
                Payment scheduled successfully
              </DialogDescription>

              <div className="px-6 pt-10 pb-6 text-center">
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center mb-6"
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[#6B8F71]">
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

                {/* Title */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-[15px] font-bold text-[#2D3436] mb-1"
                >
                  Payment Scheduled
                </motion.p>

                {/* Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mb-6"
                >
                  <span className="text-3xl font-bold text-[#2D3436]">{formattedAmount}</span>
                  <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                    {selectedToken.symbol}
                  </span>
                </motion.div>

                {/* Details card */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      To
                    </span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {formatAddress(recipient, 8)}
                    </span>
                  </div>

                  {memo && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Memo
                      </span>
                      <span className="text-[12px] text-[#2D3436] max-w-[200px] truncate">
                        {memo}
                      </span>
                    </div>
                  )}

                  {scheduledForTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Will execute at
                      </span>
                      <span className="text-[12px] font-medium text-[#6B8F71] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {scheduledForTime}
                      </span>
                    </div>
                  )}

                  {hasFee && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Service fee
                      </span>
                      <span className="text-[12px] text-[#2D3436]">
                        {feeAmount} {selectedToken.symbol}
                      </span>
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
                <Button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-11 rounded-xl font-semibold bg-[#6B8F71] hover:bg-[#6B8F71]/80 text-white"
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
  );
}

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    iconClass: 'text-coral/70',
    bgClass: 'bg-coral/6',
    ringClass: 'ring-coral/10',
  },
  executed: {
    icon: CheckCircle,
    iconClass: 'text-[#6B8F71]',
    bgClass: 'bg-[#6B8F71]/8',
    ringClass: 'ring-[#6B8F71]/15',
  },
  failed: {
    icon: XCircle,
    iconClass: 'text-coral',
    bgClass: 'bg-coral/8',
    ringClass: 'ring-coral/15',
  },
} as const;

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

function TransactionRow({
  transaction,
  onCancelled,
}: {
  transaction: ScheduledTransaction;
  onCancelled: () => void;
}): ReactElement {
  const cfg = STATUS_CONFIG[transaction.status];
  const StatusIcon = cfg.icon;
  const isPending = transaction.status === 'pending';
  const isExecuted = transaction.status === 'executed';
  const isFailed = transaction.status === 'failed';
  const explorerUrl = transaction.txHash ? getExplorerTxUrl(transaction.txHash) : null;

  const scheduledForTs =
    typeof transaction.scheduledFor === 'number'
      ? transaction.scheduledFor
      : Math.floor(new Date(transaction.scheduledFor).getTime() / 1000);
  const scheduledDate = new Date(scheduledForTs * 1000);
  const scheduledTimeStr = scheduledDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleCancel = async (): Promise<void> => {
    setIsCancelling(true);
    try {
      await deleteScheduledTransaction(transaction.id);
      setConfirmCancel(false);
      onCancelled();
    } catch {
      setIsCancelling(false);
    }
  };

  return (
    <div className="bg-white border border-[#EDE9E3] rounded-2xl hover:border-[#DDD8D2] hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-200 ">
      <div className="px-5 py-4">
        {/* Top row: status icon + amount + actions */}
        <div className="flex items-start gap-3.5">
          {/* Status icon */}
          <div
            className={`w-10 h-10 rounded-xl ${cfg.bgClass} ring-1 ${cfg.ringClass} flex items-center justify-center shrink-0 mt-0.5`}
          >
            <StatusIcon className={`h-[18px] w-[18px] ${cfg.iconClass}`} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Amount + token */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-bold text-[#2D3436] tabular-nums tracking-tight">
                {formatAmount(transaction.amount, transaction.tokenDecimals)}
              </span>
              <span className="text-[12px] font-semibold text-[#9B9590] uppercase">
                {transaction.tokenSymbol}
              </span>
            </div>

            {/* Recipient */}
            <div className="flex items-center gap-1.5 mt-1">
              <ArrowUpRight className="w-3 h-3 text-[#D6D1CC] shrink-0" />
              <span className="text-[12px] font-mono text-[#6B6560]">
                {formatAddress(transaction.to, 6)}
              </span>
              {transaction.memo && (
                <>
                  <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
                  <span className="text-[12px] text-[#9B9590] italic truncate max-w-[140px]">
                    &ldquo;{transaction.memo}&rdquo;
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right column: actions */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {isPending && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-coral/6 ring-1 ring-coral/10">
                  <Clock className="w-3.5 h-3.5 text-coral/70" />
                  <span className="text-[13px] font-bold text-coral/70 tabular-nums">
                    {formatCountdown(scheduledForTs)}
                  </span>
                </div>
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#B5B0AA] hover:text-coral hover:bg-coral/6 transition-colors"
                  title="Cancel scheduled payment"
                >
                  <Trash2 className="w-3 h-3" />
                  Cancel
                </button>
              </>
            )}

            {isExecuted && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6B8F71] bg-[#6B8F71]/8 ring-1 ring-[#6B8F71]/10 px-2.5 py-1 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                Executed
              </span>
            )}

            {isFailed && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-coral bg-coral/8 ring-1 ring-coral/10 px-2.5 py-1 rounded-lg">
                <XCircle className="w-3.5 h-3.5" />
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Bottom meta bar */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#EDE9E3]/70">
          <Clock className="w-3 h-3 text-[#D6D1CC] shrink-0" />
          <span className="text-[11px] text-[#B5B0AA]">
            {isPending ? `Executes at ${scheduledTimeStr}` : `Scheduled for ${scheduledTimeStr}`}
          </span>
          <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
          <span className="text-[11px] text-[#B5B0AA]">
            Created {formatTimeAgo(new Date(transaction.createdAt).getTime() / 1000)}
          </span>
          {explorerUrl && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B6560] hover:text-[#2D3436] transition-colors"
              >
                View tx
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </>
          )}
          {isFailed && transaction.failReason && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <button
                onClick={() => setShowError(!showError)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-coral/70 hover:text-coral transition-colors"
              >
                {transaction.attempts}/3 attempts
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${showError ? 'rotate-180' : ''}`}
                />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable error details */}
      <AnimatePresence>
        {isFailed && showError && transaction.failReason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className=""
          >
            <div className="mx-5 mb-4 px-3.5 py-2.5 rounded-xl bg-coral/[0.03] border border-coral/10">
              <p className="text-[11px] font-semibold text-coral/60 uppercase tracking-wider mb-1">
                Error Details
              </p>
              <p className="text-[12px] text-coral/80 leading-relaxed break-words whitespace-pre-wrap font-mono">
                {transaction.failReason}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={confirmCancel}
        onOpenChange={open => {
          if (!open && !isCancelling) setConfirmCancel(false);
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[380px] ">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Cancel Transaction
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              This will permanently cancel the scheduled transaction.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />
          <div className="px-6 py-5">
            <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-3 space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Amount</span>
                <span className="text-[12px] font-semibold text-[#2D3436]">
                  {formatAmount(transaction.amount, transaction.tokenDecimals)}{' '}
                  {transaction.tokenSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">To</span>
                <span className="text-[12px] font-mono text-[#2D3436]">
                  {formatAddress(transaction.to, 6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Scheduled</span>
                <span className="text-[12px] text-[#2D3436]">{scheduledTimeStr}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E07A5F]/[0.06] border border-[#E07A5F]/15">
              <AlertTriangle className="w-4 h-4 text-[#E07A5F] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#E07A5F]/80 leading-relaxed">
                This action cannot be undone. The scheduled transfer will be permanently removed.
              </p>
            </div>
          </div>
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              disabled={isCancelling}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              Keep
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E5484D] hover:bg-[#E5484D]/90 text-white gap-2"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Cancel Transaction
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
