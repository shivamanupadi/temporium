import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import type { Address } from 'viem';
import { useWalletClient } from 'wagmi';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Trash2,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Plus,
  Clock,
  Repeat,
  ShieldCheck,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import {
  getRecurringPayments,
  deleteRecurringPayment,
  createRecurringPayment,
  getRecurringPaymentExecutions,
  getRecurringPaymentsContractAddress,
  type PaginatedRecurringPaymentResponse,
} from '@/lib/recurring-payments';
import type { Token } from '@/lib/tokenlist';
import {
  formatAmount,
  parseAmount,
  formatAddress,
  formatTimeAgo,
  isValidAddress,
  cn,
} from '@/lib/utils';
import {
  Actions,
  tempoPublicClient,
  tempoChain,
  getExplorerTxUrl,
  waitForTx,
} from '@/lib/tempo-client';
import { TIMING, TEMPO_NETWORK, RECURRING_INTERVAL_PRESETS, LINKS } from '@/lib/constants';
import type { RecurringPayment, RecurringPaymentStatus, RecurringPaymentExecution } from '@/types';

// ---------------------------------------------------------------------------
// Contract ABI (minimal for createSubscription)
// ---------------------------------------------------------------------------

const RECURRING_PAYMENTS_ABI = [
  {
    type: 'function',
    name: 'createSubscription',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
      { name: 'maxPayments', type: 'uint256' },
      { name: 'startAt', type: 'uint256' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

interface RecurringSearchParams {
  filter?: StatusFilter;
}

export const Route = createFileRoute('/portal/recurring-payments')({
  component: RecurringPaymentsPage,
  validateSearch: (search: Record<string, unknown>): RecurringSearchParams => {
    const f = search.filter;
    return {
      filter:
        f === 'all' || f === 'active' || f === 'completed' || f === 'cancelled' || f === 'failed'
          ? f
          : undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled' | 'failed';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'failed', label: 'Failed' },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatInterval(seconds: number): string {
  if (seconds >= 86400 * 30) {
    const months = Math.round(seconds / (86400 * 30));
    return months === 1 ? 'Monthly' : `Every ${months} months`;
  }
  if (seconds >= 86400 * 7) {
    const weeks = Math.round(seconds / (86400 * 7));
    return weeks === 1 ? 'Weekly' : `Every ${weeks} weeks`;
  }
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return days === 1 ? 'Daily' : `Every ${days} days`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return hours === 1 ? 'Hourly' : `Every ${hours} hours`;
  }
  return `Every ${seconds}s`;
}

function formatNextPayment(value: number | string): string {
  // API returns ISO string via Drizzle timestamp mode; handle both string and number
  const date =
    typeof value === 'string' ? new Date(value) : new Date(value > 1e12 ? value : value * 1000);
  if (isNaN(date.getTime())) return 'Unknown';

  const now = Date.now();
  const diff = date.getTime() - now;

  if (diff <= 0) return 'Due now';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`;
  if (diff < 3600_000) {
    const m = Math.floor(diff / 60_000);
    const s = Math.ceil((diff % 60_000) / 1000);
    return s > 0 ? `in ${m}m ${s}s` : `in ${m}m`;
  }
  if (diff < 86400_000) return `in ${Math.round(diff / 3600_000)}h`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function RecurringPaymentsPage(): ReactElement {
  const { filter: searchFilter } = Route.useSearch();
  const navigate = useNavigate();
  const { address, isConnected, approveToken } = useTempo();
  const { data: walletClient } = useWalletClient();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const filter: StatusFilter = searchFilter ?? 'active';
  const setFilter = useCallback(
    (next: StatusFilter) => {
      navigate({
        to: '/portal/recurring-payments',
        search: { filter: next === 'active' ? undefined : next },
        replace: true,
      } as any);
    },
    [navigate]
  );

  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [, setTick] = useState(0);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | ''>('');

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);

  // Fetch contract address from API
  useEffect(() => {
    getRecurringPaymentsContractAddress()
      .then(setContractAddress)
      .catch(() => {});
  }, []);

  const fetchPayments = useCallback(
    async (cursor?: string): Promise<void> => {
      try {
        const res: PaginatedRecurringPaymentResponse = await getRecurringPayments({
          status: filter === 'all' ? undefined : filter,
          network: TEMPO_NETWORK,
          cursor,
          limit: PAGE_SIZE,
        });
        if (cursor) {
          setPayments(prev => [...prev, ...res.items]);
        } else {
          setPayments(res.items);
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
      await fetchPayments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = (): void => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    fetchPayments(nextCursor);
  };

  useEffect(() => {
    setIsLoading(true);
    setPayments([]);
    setNextCursor(null);
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    const interval = setInterval(() => fetchPayments(), TIMING.SCHEDULED_TX_CHECK_MS);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const hasActive = payments.some(p => p.status === 'active');
  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [hasActive]);

  const handleCreated = (): void => {
    setShowCreate(false);
    fetchPayments();
  };

  const handleCancelled = (): void => {
    fetchPayments();
  };

  if (!isConnected || !address) return <></>;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between shrink-0"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Recurring Payments</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">Automated token transfers on a schedule</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] text-[#B5B0AA]">Contract:</span>
            {contractAddress ? (
              <a
                href={`${LINKS.explorer}/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-[#9B72CF]/70 hover:text-[#9B72CF] transition-colors"
              >
                {formatAddress(contractAddress, 6)}
                <ExternalLink className="w-2.5 h-2.5 inline ml-1 -mt-0.5" />
              </a>
            ) : (
              <span className="text-[11px] text-[#B5B0AA]">Loading...</span>
            )}
          </div>
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
            onClick={() => setShowCreate(true)}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Subscription
          </Button>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <Tabs
        value={filter}
        onValueChange={(v: string) => setFilter(v as StatusFilter)}
        className="shrink-0"
      >
        <TabsList className="bg-[#F5F2ED] rounded-xl p-1">
          {FILTERS.map(f => (
            <TabsTrigger
              key={f.key}
              value={f.key}
              className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
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
                Failed to load recurring payments
              </h2>
              <p className="text-[13px] text-[#6B6560] max-w-[280px] mx-auto leading-relaxed mb-4">
                {error}
              </p>
              <Button
                onClick={() => fetchPayments()}
                variant="outline"
                className="h-9 px-4 rounded-xl text-[13px] font-semibold border-[#EDE9E3]"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : payments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-[#B5B0AA]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#2D3436]">
              {filter === 'all'
                ? 'No Recurring Payments'
                : `No ${FILTERS.find(f => f.key === filter)?.label} Payments`}
            </h3>
            <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
              {filter === 'all' || filter === 'active'
                ? 'Set up a subscription to automatically send tokens on a recurring schedule.'
                : 'No payments match this filter.'}
            </p>
            {(filter === 'all' || filter === 'active') && (
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
              >
                <Plus className="w-4 h-4" />
                New Subscription
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {payments.map((payment, index) => (
                <motion.div
                  key={payment.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: index < PAGE_SIZE ? index * 0.03 : 0, duration: 0.2 }}
                >
                  <PaymentRow payment={payment} onCancelled={handleCancelled} />
                </motion.div>
              ))}
            </AnimatePresence>

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

      {/* Create subscription dialog */}
      {showCreate && (
        <CreateSubscriptionDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          address={address}
          tokens={tokens}
          preferredFeeToken={preferredFeeToken}
          approveToken={approveToken}
          walletClient={walletClient ?? null}
          onCreated={handleCreated}
          contractAddress={contractAddress}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Subscription Dialog
// ---------------------------------------------------------------------------

type CreateStep = 'form' | 'confirm' | 'processing' | 'success';

function CreateSubscriptionDialog({
  open,
  onOpenChange,
  address,
  tokens,
  preferredFeeToken,
  approveToken,
  walletClient,
  onCreated,
  contractAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  tokens: Token[];
  preferredFeeToken: Address | null;
  approveToken: (params: {
    token: Address;
    spender: Address;
    amount: bigint;
    feeToken?: Address;
  }) => Promise<string>;
  walletClient: any;
  onCreated: () => void;
  contractAddress: `0x${string}` | '';
}): ReactElement {
  const [step, setStep] = useState<CreateStep>('form');
  const [processingStatus, setProcessingStatus] = useState('');

  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState<number>(
    RECURRING_INTERVAL_PRESETS[3].seconds
  ); // Monthly
  const [customInterval, setCustomInterval] = useState('');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<'hours' | 'days'>('days');
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [maxPayments, setMaxPayments] = useState('0');
  const [selectedToken, setSelectedToken] = useState<Token | null>(tokens[0] ?? null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Result state
  const [resultTxHash, setResultTxHash] = useState<string | null>(null);

  // Set fee token
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

  const balance = useTokenBalance(selectedToken?.address, address as Address);
  const tokenDecimals = selectedToken?.decimals ?? 6;
  const parsedAmount = parseAmount(amount, tokenDecimals);
  const hasValidRecipient = isValidAddress(recipient);
  const hasValidAmount = parsedAmount > 0n;

  const effectiveInterval = isCustomInterval
    ? (parseInt(customInterval) || 0) * (customIntervalUnit === 'hours' ? 3600 : 86400)
    : intervalSeconds;
  const hasValidInterval = effectiveInterval >= 60;

  const parsedMaxPayments = parseInt(maxPayments) || 0;

  const isFormValid =
    hasValidRecipient &&
    hasValidAmount &&
    hasValidInterval &&
    selectedToken &&
    feeToken &&
    !!contractAddress;

  const handleAmountChange = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    const parts = cleaned.split('.');
    if (parts[1] && parts[1].length > 6) return;
    setAmount(cleaned);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !selectedToken || !feeToken) return;
    setStep('processing');

    try {
      const feeTokenAddress = feeToken.address;
      if (!contractAddress) throw new Error('Contract address not loaded');
      if (!walletClient) throw new Error('Wallet not connected');

      // Step 1: Approve token spend FIRST (so the relayer can pull funds immediately)
      setProcessingStatus('Checking token allowance...');
      const currentAllowance = await Actions.token.getAllowance(tempoPublicClient, {
        token: selectedToken.address,
        spender: contractAddress,
        account: address as Address,
      });

      // For unlimited subscriptions, approve max uint256; for bounded ones, approve total cost
      const totalNeeded =
        parsedMaxPayments > 0
          ? parsedAmount * BigInt(parsedMaxPayments)
          : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      if (currentAllowance < totalNeeded) {
        setProcessingStatus('Approving token spend...');
        const approveHash = await approveToken({
          token: selectedToken.address,
          spender: contractAddress,
          amount: totalNeeded,
          feeToken: feeTokenAddress,
        });
        await waitForTx(approveHash as `0x${string}`);
      }

      // Step 2: Create on-chain subscription
      setProcessingStatus('Creating subscription on-chain...');

      const contractArgs = {
        address: contractAddress,
        abi: RECURRING_PAYMENTS_ABI,
        functionName: 'createSubscription' as const,
        args: [
          recipient as Address,
          selectedToken.address,
          parsedAmount,
          BigInt(effectiveInterval),
          BigInt(parsedMaxPayments),
          BigInt(Math.floor(Date.now() / 1000) + effectiveInterval), // startAt = now + interval
        ] as const,
      };

      // Simulate first to catch errors before spending gas
      await tempoPublicClient.simulateContract({
        ...contractArgs,
        account: address as Address,
      });

      // Write via walletClient (signs locally → eth_sendRawTransaction)
      const txHash = await walletClient.writeContract(contractArgs);
      const receipt = await waitForTx(txHash);

      // Parse the subscription ID from the SubscriptionCreated event log
      let subscriptionId = 0;
      try {
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics[1]) {
            subscriptionId = Number(BigInt(log.topics[1]));
            break;
          }
        }
      } catch {
        // Fallback: could not parse event
      }

      // Step 3: Register with API + Durable Object
      setProcessingStatus('Setting up recurring schedule...');
      const nextPaymentAt = new Date(Date.now() + effectiveInterval * 1000).toISOString();

      await createRecurringPayment({
        recipient,
        token: selectedToken.address,
        tokenSymbol: selectedToken.symbol,
        tokenDecimals: selectedToken.decimals,
        amount: parsedAmount.toString(),
        intervalSeconds: effectiveInterval,
        maxPayments: parsedMaxPayments,
        subscriptionId,
        contractAddress,
        nextPaymentAt,
        txHash,
        label: label || undefined,
      });

      setResultTxHash(txHash);
      setStep('success');
      toast.success('Recurring payment created');
    } catch (err) {
      console.error('Create recurring payment failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to create subscription';
      toast.error(message);
      setStep('confirm');
    }
  }, [
    isFormValid,
    selectedToken,
    feeToken,
    walletClient,
    address,
    recipient,
    parsedAmount,
    effectiveInterval,
    parsedMaxPayments,
    label,
    approveToken,
    contractAddress,
  ]);

  const formattedAmount = parsedAmount > 0n ? formatAmount(parsedAmount, tokenDecimals, 2) : '0.00';

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && step === 'processing') return; // Don't close during processing
      if (!isOpen && step === 'success') {
        onCreated();
        return;
      }
      onOpenChange(isOpen);
    },
    [step, onCreated, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideClose={step === 'processing'}
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl"
      >
        <AnimatePresence mode="wait">
          {/* ─── Form Step ─────────────────────────────────────── */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-bold text-[#2D3436]">
                  New Recurring Payment
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                  Set up automated token transfers on a schedule
                </DialogDescription>
              </div>
              <div className="border-t border-[#EDE9E3]/60" />

              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Recipient */}
                <ContactPicker value={recipient} onChange={setRecipient} selfAddress={address} />

                {/* Amount + Token */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Amount per payment
                    </Label>
                    {selectedToken && !balance.isLoading && (
                      <span className="text-[11px] text-[#9B9590]">
                        Balance: {formatAmount(balance.data.value, tokenDecimals, 2)}{' '}
                        {selectedToken.symbol}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => handleAmountChange(e.target.value)}
                      className="text-[16px] font-semibold h-11 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:border-sage focus:ring-1 focus:ring-sage/20 flex-1"
                    />
                    {selectedToken && (
                      <TokenPicker
                        token={selectedToken}
                        tokens={tokens}
                        onChange={setSelectedToken}
                        accentColor="#5B9A6F"
                      />
                    )}
                  </div>
                </div>

                {/* Interval */}
                <div>
                  <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Frequency
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {RECURRING_INTERVAL_PRESETS.map(preset => {
                      const isActive = !isCustomInterval && intervalSeconds === preset.seconds;
                      return (
                        <button
                          key={preset.seconds}
                          type="button"
                          onClick={() => {
                            setIntervalSeconds(preset.seconds);
                            setIsCustomInterval(false);
                          }}
                          className={cn(
                            'px-4 py-2 rounded-xl text-[13px] font-medium transition-all border',
                            isActive
                              ? 'bg-sage text-white border-sage shadow-sm'
                              : 'bg-[#FDFBF8] text-[#6B6560] border-[#EDE9E3] hover:border-sage/40 hover:bg-sage/5'
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setIsCustomInterval(true)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-[13px] font-medium transition-all border',
                        isCustomInterval
                          ? 'bg-sage text-white border-sage shadow-sm'
                          : 'bg-[#FDFBF8] text-[#6B6560] border-[#EDE9E3] hover:border-sage/40 hover:bg-sage/5'
                      )}
                    >
                      Custom
                    </button>
                  </div>

                  {isCustomInterval && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[12px] text-[#9B9590]">Every</span>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={customInterval}
                        onChange={e => setCustomInterval(e.target.value)}
                        className="w-20 h-9 rounded-xl text-[13px] border-[#EDE9E3] bg-[#FDFBF8]"
                      />
                      <div className="flex gap-1">
                        {(['hours', 'days'] as const).map(unit => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setCustomIntervalUnit(unit)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                              customIntervalUnit === unit
                                ? 'bg-sage text-white'
                                : 'bg-[#F5F2ED] text-[#6B6560]'
                            )}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Max payments */}
                <div>
                  <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Max payments{' '}
                    <span className="font-normal normal-case text-[#B5B0AA]">(0 = unlimited)</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={maxPayments}
                    onChange={e => setMaxPayments(e.target.value)}
                    className="w-32 h-9 rounded-xl text-[13px] border-[#EDE9E3] bg-[#FDFBF8]"
                  />
                </div>

                {/* Label */}
                <div>
                  <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Label <span className="font-normal normal-case text-[#B5B0AA]">(optional)</span>
                  </Label>
                  <Input
                    placeholder="e.g. Rent, Salary, Subscription..."
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    maxLength={100}
                    className="h-9 rounded-xl text-[13px] border-[#EDE9E3] bg-[#FDFBF8]"
                  />
                </div>

                {/* Fee token */}
                {feeToken && (
                  <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
                )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 pt-0 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!isFormValid}
                  onClick={() => setStep('confirm')}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white gap-2"
                >
                  Review
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Confirm Step ──────────────────────────────────── */}
          {step === 'confirm' && selectedToken && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-bold text-[#2D3436]">
                  Confirm Subscription
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
                  Review the recurring payment details
                </DialogDescription>
              </div>
              <div className="border-t border-[#EDE9E3]/60" />

              <div className="px-6 py-5 space-y-3">
                {/* Summary card */}
                <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Amount</span>
                    <span className="text-[14px] font-bold text-[#2D3436]">
                      {formattedAmount} {selectedToken.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Recipient</span>
                    <span className="text-[12px] font-mono text-[#2D3436]">
                      {formatAddress(recipient, 6)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Frequency</span>
                    <span className="text-[12px] font-semibold text-[#2D3436]">
                      {formatInterval(effectiveInterval)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Total payments</span>
                    <span className="text-[12px] text-[#2D3436]">
                      {parsedMaxPayments > 0 ? parsedMaxPayments : 'Unlimited'}
                    </span>
                  </div>
                  {parsedMaxPayments > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                      <span className="text-[12px] text-[#9B9590]">Total cost</span>
                      <span className="text-[12px] font-bold text-[#2D3436]">
                        {formatAmount(
                          (parsedAmount * BigInt(parsedMaxPayments)).toString(),
                          tokenDecimals,
                          2
                        )}{' '}
                        {selectedToken.symbol}
                      </span>
                    </div>
                  )}
                  {label && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">Label</span>
                      <span className="text-[12px] text-[#2D3436] italic">{label}</span>
                    </div>
                  )}
                </div>

                {/* What happens info */}
                <div className="rounded-xl bg-sage/[0.06] border border-sage/15 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-sage uppercase tracking-wider">
                    What will happen
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-sage/70 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-sage/80 leading-relaxed">
                        Approve the contract to spend your {selectedToken.symbol} (if needed)
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Repeat className="w-3.5 h-3.5 text-sage/70 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-sage/80 leading-relaxed">
                        Create the subscription on-chain
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-sage/70 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-sage/80 leading-relaxed">
                        Payments execute automatically — tokens stay in your wallet until each
                        payment is due
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-0 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white gap-2"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Create Subscription
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Processing Step ───────────────────────────────── */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="relative overflow-hidden"
            >
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">
                Creating your recurring payment
              </DialogDescription>

              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-16 -left-16 w-48 h-48 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(91,154,111,0.2) 0%, transparent 70%)',
                  }}
                />
              </div>

              <div className="relative px-6 py-14 text-center">
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
                        stroke="rgba(91,154,111,0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="50 140"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-sage" />
                  </motion.div>
                </div>

                <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                  {processingStatus || 'Processing...'}
                </p>
                {selectedToken && (
                  <p className="text-2xl font-bold text-[#2D3436] tracking-tight">
                    {formattedAmount}{' '}
                    <span className="text-lg font-semibold text-[#9B9590]">
                      {selectedToken.symbol}
                    </span>{' '}
                    <span className="text-lg text-[#B5B0AA]">
                      {formatInterval(effectiveInterval)}
                    </span>
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── Success Step ──────────────────────────────────── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden"
            >
              <DialogTitle className="sr-only">Subscription Created</DialogTitle>
              <DialogDescription className="sr-only">
                Your recurring payment has been set up
              </DialogDescription>

              <div className="px-6 pt-10 pb-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-[#5B9A6F] flex items-center justify-center">
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
                  Subscription Created
                </motion.p>

                {selectedToken && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mb-6"
                  >
                    <span className="text-2xl font-bold text-[#2D3436]">{formattedAmount}</span>
                    <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                      {selectedToken.symbol}
                    </span>
                    <span className="text-lg text-[#B5B0AA] ml-1.5">
                      {formatInterval(effectiveInterval)}
                    </span>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-2 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      To
                    </span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {formatAddress(recipient, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Next payment
                    </span>
                    <span className="text-[12px] text-sage font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatInterval(effectiveInterval)} from now
                    </span>
                  </div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="px-6 pb-6 flex gap-3"
              >
                {resultTxHash && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(getExplorerTxUrl(resultTxHash), '_blank')}
                    className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Explorer
                  </Button>
                )}
                <Button
                  onClick={() => {
                    onCreated();
                  }}
                  className="flex-1 h-11 rounded-xl font-semibold bg-sage hover:bg-sage/80 text-white"
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

const STATUS_CONFIG: Record<
  RecurringPaymentStatus,
  { icon: typeof Repeat; iconClass: string; bgClass: string; ringClass: string }
> = {
  active: {
    icon: Repeat,
    iconClass: 'text-[#5B9A6F]',
    bgClass: 'bg-[#5B9A6F]/8',
    ringClass: 'ring-[#5B9A6F]/15',
  },
  completed: {
    icon: CheckCircle,
    iconClass: 'text-[#9B72CF]',
    bgClass: 'bg-[#9B72CF]/8',
    ringClass: 'ring-[#9B72CF]/15',
  },
  cancelled: {
    icon: XCircle,
    iconClass: 'text-[#9B9590]',
    bgClass: 'bg-[#9B9590]/8',
    ringClass: 'ring-[#9B9590]/15',
  },
  failed: {
    icon: XCircle,
    iconClass: 'text-coral',
    bgClass: 'bg-coral/8',
    ringClass: 'ring-coral/15',
  },
};

const STATUS_LABELS: Record<RecurringPaymentStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

// ---------------------------------------------------------------------------
// Payment row
// ---------------------------------------------------------------------------

function PaymentRow({
  payment,
  onCancelled,
}: {
  payment: RecurringPayment;
  onCancelled: () => void;
}): ReactElement {
  const cfg = STATUS_CONFIG[payment.status];
  const StatusIcon = cfg.icon;
  const isActive = payment.status === 'active';
  const isFailed = payment.status === 'failed';
  const explorerUrl = payment.txHash ? getExplorerTxUrl(payment.txHash) : null;

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [executions, setExecutions] = useState<RecurringPaymentExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (executions.length === 0) {
      setLoadingHistory(true);
      try {
        const data = await getRecurringPaymentExecutions(payment.id);
        setExecutions(data);
      } catch {
        // ignore
      } finally {
        setLoadingHistory(false);
      }
    }
  }, [showHistory, executions.length, payment.id]);

  const handleCancel = async (): Promise<void> => {
    setIsCancelling(true);
    try {
      await deleteRecurringPayment(payment.id);
      setConfirmCancel(false);
      onCancelled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription');
      setIsCancelling(false);
    }
  };

  const progressText =
    payment.maxPayments > 0
      ? `${payment.paymentsMade}/${payment.maxPayments} payments`
      : `${payment.paymentsMade} payments`;

  return (
    <div className="bg-white border border-[#EDE9E3] rounded-2xl hover:border-[#DDD8D2] hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-200 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl ${cfg.bgClass} ring-1 ${cfg.ringClass} flex items-center justify-center shrink-0 mt-0.5`}
          >
            <StatusIcon className={`h-[18px] w-[18px] ${cfg.iconClass}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-bold text-[#2D3436] tabular-nums tracking-tight">
                {formatAmount(payment.amount, payment.tokenDecimals, 2)}
              </span>
              <span className="text-[12px] font-semibold text-[#9B9590] uppercase">
                {payment.tokenSymbol}
              </span>
              <span className="text-[11px] text-[#B5B0AA] ml-1">
                {formatInterval(payment.intervalSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <ArrowUpRight className="w-3 h-3 text-[#D6D1CC] shrink-0" />
              <span className="text-[12px] font-mono text-[#6B6560]">
                {formatAddress(payment.recipient, 6)}
              </span>
              {payment.label && (
                <>
                  <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
                  <span className="text-[12px] text-[#9B9590] italic truncate max-w-[140px]">
                    {payment.label}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {isActive && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#5B9A6F]/6 ring-1 ring-[#5B9A6F]/10">
                  <Clock className="w-3.5 h-3.5 text-[#5B9A6F]/70" />
                  <span className="text-[12px] font-semibold text-[#5B9A6F]/80">
                    Next {formatNextPayment(payment.nextPaymentAt)}
                  </span>
                </div>
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#B5B0AA] hover:text-coral hover:bg-coral/6 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Cancel
                </button>
              </>
            )}

            {!isActive && (
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${cfg.iconClass} ${cfg.bgClass} ring-1 ${cfg.ringClass} px-2.5 py-1 rounded-lg`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {STATUS_LABELS[payment.status]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-[#EDE9E3]/70">
          <Repeat className="w-3 h-3 text-[#D6D1CC] shrink-0" />
          <span className="text-[11px] text-[#B5B0AA]">{progressText}</span>
          <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
          <span className="text-[11px] text-[#B5B0AA]">
            Created {formatTimeAgo(new Date(payment.createdAt).getTime() / 1000)}
          </span>
          {payment.lastPaidAt && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <span className="text-[11px] text-[#B5B0AA]">
                Last paid {formatTimeAgo(new Date(payment.lastPaidAt).getTime() / 1000)}
              </span>
            </>
          )}
          {explorerUrl && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9B72CF] hover:text-[#8562BF] transition-colors"
              >
                View tx
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </>
          )}
          {isFailed && payment.failReason && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <button
                onClick={() => setShowError(!showError)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-coral/70 hover:text-coral transition-colors"
              >
                Error details
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${showError ? 'rotate-180' : ''}`}
                />
              </button>
            </>
          )}
          {payment.paymentsMade > 0 && (
            <>
              <span className="text-[8px] text-[#D6D1CC]">&middot;</span>
              <button
                onClick={toggleHistory}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9B72CF]/70 hover:text-[#9B72CF] transition-colors"
              >
                History
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
                />
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-4 px-3.5 py-2.5 rounded-xl bg-[#9B72CF]/[0.03] border border-[#9B72CF]/10">
              <p className="text-[11px] font-semibold text-[#9B72CF]/60 uppercase tracking-wider mb-2">
                Payment History
              </p>
              {loadingHistory ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B72CF]/40" />
                  <span className="text-[12px] text-[#9B9590]">Loading...</span>
                </div>
              ) : executions.length === 0 ? (
                <p className="text-[12px] text-[#9B9590] py-1">No executions recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {executions.map(exec => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-[#EDE9E3]/40 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#6B6560]">
                          #{exec.paymentNumber}
                        </span>
                        <span className="text-[11px] text-[#9B9590]">
                          {formatAmount(exec.amount, payment.tokenDecimals, 2)}{' '}
                          {payment.tokenSymbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#B5B0AA]">
                          {formatTimeAgo(new Date(exec.executedAt).getTime() / 1000)}
                        </span>
                        {exec.txHash && exec.txHash.startsWith('0x') ? (
                          <a
                            href={getExplorerTxUrl(exec.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#9B72CF]/60 hover:text-[#9B72CF] transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : exec.txHash === 'synced-from-chain' ? (
                          <span className="text-[10px] text-[#B5B0AA] italic">synced</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFailed && showError && payment.failReason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-4 px-3.5 py-2.5 rounded-xl bg-coral/[0.03] border border-coral/10">
              <p className="text-[11px] font-semibold text-coral/60 uppercase tracking-wider mb-1">
                Error Details
              </p>
              <p className="text-[12px] text-coral/80 leading-relaxed break-words whitespace-pre-wrap font-mono">
                {payment.failReason}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={confirmCancel}
        onOpenChange={open => {
          if (!open && !isCancelling) setConfirmCancel(false);
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Cancel Subscription
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              This will stop all future recurring payments.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />
          <div className="px-6 py-5">
            <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-3 space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Amount</span>
                <span className="text-[12px] font-semibold text-[#2D3436]">
                  {formatAmount(payment.amount, payment.tokenDecimals, 2)} {payment.tokenSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">To</span>
                <span className="text-[12px] font-mono text-[#2D3436]">
                  {formatAddress(payment.recipient, 6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Frequency</span>
                <span className="text-[12px] text-[#2D3436]">
                  {formatInterval(payment.intervalSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Progress</span>
                <span className="text-[12px] text-[#2D3436]">{progressText}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E07A5F]/[0.06] border border-[#E07A5F]/15">
              <AlertTriangle className="w-4 h-4 text-[#E07A5F] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#E07A5F]/80 leading-relaxed">
                You should also cancel the on-chain subscription and revoke the token approval to
                fully stop this payment.
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
                  Cancel Subscription
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
