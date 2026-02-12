import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
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
import {
  getScheduledTransactions,
  deleteScheduledTransaction,
  type PaginatedScheduledTxResponse,
} from '@/lib/scheduled-transactions';
import { formatAmount, formatAddress, formatCountdown, formatTimeAgo } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import type { ScheduledTransaction } from '@/types';

export const Route = createFileRoute('/portal/scheduled')({
  component: ScheduledPage,
});

// ---------------------------------------------------------------------------
// Status filter
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'pending' | 'executed' | 'failed';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'executed', label: 'Executed' },
  { key: 'failed', label: 'Failed' },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ScheduledPage(): ReactElement {
  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
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
    [filter],
  );

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await fetchTransactions();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = () => {
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

  const handleCancelled = () => {
    fetchTransactions();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
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
            className="h-9 px-3 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </Button>
          <Link to="/portal/send" search={{ mode: 'scheduled' }}>
            <Button className="h-9 px-4 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              New Transfer
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-[#F5F2ED]/60 rounded-xl p-1 w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`
              px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all
              ${
                filter === f.key
                  ? 'bg-white text-[#2D3436] shadow-sm'
                  : 'text-[#9B9590] hover:text-[#6B6560]'
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
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
          className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D4A056]/8 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-7 w-7 text-[#D4A056]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">
              {filter === 'all'
                ? 'No Scheduled Transactions'
                : `No ${FILTERS.find(f => f.key === filter)?.label} Transactions`}
            </h2>
            <p className="text-[13px] text-[#6B6560] max-w-[280px] mx-auto leading-relaxed mb-4">
              {filter === 'all'
                ? 'Schedule a transfer to send tokens at a specific time in the future.'
                : 'No transactions match this filter.'}
            </p>
            {filter === 'all' && (
              <Link to="/portal/send" search={{ mode: 'scheduled' }}>
                <Button
                  variant="outline"
                  className="h-9 px-4 rounded-xl text-[13px] font-semibold border-[#EDE9E3]"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Schedule a Transfer
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2">
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
            <div className="pt-2 text-center">
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
  );
}

// ---------------------------------------------------------------------------
// Status badge configs
// ---------------------------------------------------------------------------

const STATUS_BADGE = {
  pending: {
    icon: Clock,
    text: 'text-[#D4A056]',
    bg: 'bg-[#D4A056]/8',
  },
  executed: {
    icon: CheckCircle,
    text: 'text-[var(--color-sage)]',
    bg: 'bg-[var(--color-sage)]/8',
  },
  failed: {
    icon: XCircle,
    text: 'text-coral',
    bg: 'bg-coral/8',
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
  const badge = STATUS_BADGE[transaction.status];
  const StatusIcon = badge.icon;
  const isPending = transaction.status === 'pending';
  const isExecuted = transaction.status === 'executed';
  const isFailed = transaction.status === 'failed';
  const explorerUrl = transaction.txHash ? getExplorerTxUrl(transaction.txHash) : null;

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await deleteScheduledTransaction(transaction.id);
      onCancelled();
    } catch {
      setIsCancelling(false);
      setConfirmCancel(false);
    }
  };

  return (
    <div className="bg-white border border-[#EDE9E3] rounded-xl hover:bg-[#FDFBF8] transition-colors">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Status icon */}
        <div
          className={`w-8 h-8 rounded-lg ${badge.bg} flex items-center justify-center shrink-0`}
        >
          <StatusIcon className={`h-4 w-4 ${badge.text}`} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold text-[#2D3436] tabular-nums">
              {formatAmount(transaction.amount, transaction.tokenDecimals, 2)}
            </span>
            <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase">
              {transaction.tokenSymbol}
            </span>
            <ArrowUpRight className="w-3 h-3 text-[#D6D1CC]" />
            <span className="text-[11px] font-mono text-[#9B9590]">
              {formatAddress(transaction.to, 4)}
            </span>
            {transaction.memo && (
              <>
                <span className="text-[9px] text-[#D6D1CC]">&middot;</span>
                <span className="text-[11px] text-[#B5B0AA] italic truncate max-w-[100px]">
                  {transaction.memo}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-[#B5B0AA]">
              {formatTimeAgo(new Date(transaction.createdAt).getTime() / 1000)}
            </span>
            {explorerUrl && (
              <>
                <span className="text-[9px] text-[#D6D1CC]">&middot;</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#9B72CF] hover:text-[#8562BF] transition-colors"
                >
                  Tx
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
            {isFailed && transaction.failReason && (
              <>
                <span className="text-[9px] text-[#D6D1CC]">&middot;</span>
                <button
                  onClick={() => setShowError(!showError)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-coral/70 hover:text-coral transition-colors"
                >
                  {transaction.attempts}/3 attempts
                  <ChevronDown
                    className={`w-2.5 h-2.5 transition-transform ${showError ? 'rotate-180' : ''}`}
                  />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: status actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isPending && (
            <>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#D4A056]/8">
                <Clock className="w-3 h-3 text-[#D4A056]" />
                <span className="text-[12px] font-bold text-[#D4A056] tabular-nums">
                  {formatCountdown(
                    Math.floor(new Date(transaction.scheduledFor).getTime() / 1000),
                  )}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {!confirmCancel ? (
                  <motion.button
                    key="cancel-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setConfirmCancel(true)}
                    className="p-1.5 rounded-lg text-[#B5B0AA] hover:text-coral hover:bg-coral/8 transition-colors"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="confirm-btns"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-1"
                  >
                    <button
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-coral text-white hover:bg-coral/80 disabled:opacity-50 transition-colors"
                    >
                      {isCancelling ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      disabled={isCancelling}
                      className="h-6 px-2 rounded-md text-[11px] font-medium text-[#9B9590] hover:bg-[#F5F2ED] transition-colors"
                    >
                      No
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {isExecuted && (
            <div className="flex items-center gap-1.5">
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[#9B72CF] hover:bg-[#9B72CF]/8 transition-colors"
                  title="View on explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-sage)] bg-[var(--color-sage)]/8 px-2 py-0.5 rounded-md">
                <CheckCircle className="w-3 h-3" />
                Done
              </span>
            </div>
          )}

          {isFailed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-coral bg-coral/8 px-2 py-0.5 rounded-md">
              <XCircle className="w-3 h-3" />
              Failed
            </span>
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
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-coral/[0.04] border border-coral/10">
              <p className="text-[11px] text-coral/80 leading-relaxed break-words whitespace-pre-wrap">
                {transaction.failReason}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
