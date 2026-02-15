import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
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

export const Route = createFileRoute('/portal/scheduled')({
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
        to: '/portal/scheduled',
        search: { filter: next === 'pending' ? undefined : next },
        replace: true,
      } as any);
    },
    [navigate]
  );

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
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">
            Scheduled Transactions
          </h1>
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
          <Link to="/portal/send" search={{ mode: 'scheduled' }}>
            <Button className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              New Transfer
            </Button>
          </Link>
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
              {f.icon && <f.icon className="w-3.5 h-3.5 mr-1.5" />}
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
                ? 'No Scheduled Transactions'
                : `No ${FILTERS.find(f => f.key === filter)?.label} Transactions`}
            </h3>
            <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
              {filter === 'all'
                ? 'Schedule a transfer to send tokens at a specific time in the future.'
                : 'No transactions match this filter.'}
            </p>
            {filter === 'all' && (
              <Link to="/portal/send" search={{ mode: 'scheduled' }}>
                <Button
                  variant="outline"
                  className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
                >
                  <Send className="w-4 h-4" />
                  Schedule a Transfer
                </Button>
              </Link>
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
    </div>
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
    iconClass: 'text-[#9B72CF]',
    bgClass: 'bg-[#9B72CF]/8',
    ringClass: 'ring-[#9B72CF]/15',
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
    <div className="bg-white border border-[#EDE9E3] rounded-2xl hover:border-[#DDD8D2] hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-200 overflow-hidden">
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
                {formatAmount(transaction.amount, transaction.tokenDecimals, 2)}
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
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#9B72CF] bg-[#9B72CF]/8 ring-1 ring-[#9B72CF]/10 px-2.5 py-1 rounded-lg">
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
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9B72CF] hover:text-[#8562BF] transition-colors"
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
            className="overflow-hidden"
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
        <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden">
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
                  {formatAmount(transaction.amount, transaction.tokenDecimals, 2)}{' '}
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
