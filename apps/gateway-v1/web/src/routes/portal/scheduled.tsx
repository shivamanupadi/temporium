import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api-client';
import { formatAmount, formatAddress, formatCountdown, formatTimeAgo } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import type { ScheduledTransaction } from '@/types';

export const Route = createFileRoute('/portal/scheduled')({
  component: ScheduledPage,
});

/** Stagger children animations */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: '#D4A056',
    bg: 'bg-[#D4A056]/10',
    text: 'text-[#D4A056]',
    border: 'border-[#D4A056]/20',
  },
  executed: {
    label: 'Executed',
    icon: CheckCircle,
    color: '#5B9A6F',
    bg: 'bg-[#5B9A6F]/10',
    text: 'text-[#5B9A6F]',
    border: 'border-[#5B9A6F]/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: '#E07A5F',
    bg: 'bg-[#E07A5F]/10',
    text: 'text-[#E07A5F]',
    border: 'border-[#E07A5F]/20',
  },
  expired: {
    label: 'Expired',
    icon: AlertTriangle,
    color: '#9B9590',
    bg: 'bg-[#9B9590]/10',
    text: 'text-[#9B9590]',
    border: 'border-[#9B9590]/20',
  },
} as const;

function ScheduledPage(): ReactElement {
  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fetchTransactions = useCallback(async (): Promise<void> => {
    try {
      const data = await apiGet<ScheduledTransaction[]>('/v1/scheduled-transactions');
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, TIMING.SCHEDULED_TX_CHECK_MS);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // Countdown timer tick for pending transactions
  const hasPending = transactions.some((tx) => tx.status === 'pending');

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => setTick((t) => t + 1), TIMING.COUNTDOWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPending]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#B5B0AA]" />
        <p className="text-[14px] text-[#9B9590] mt-3">Loading scheduled transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-[#E07A5F]" />
        </div>
        <p className="text-[14px] font-medium text-[#2D3436] mb-1">Failed to load transactions</p>
        <p className="text-[13px] text-[#9B9590] mb-4">{error}</p>
        <Button
          onClick={fetchTransactions}
          className="h-9 px-4 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">
            Scheduled Transactions
          </h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Manage your time-locked and scheduled transfers.
          </p>
        </div>
        <Link to="/portal/send">
          <Button className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white">
            <Send className="w-4 h-4 mr-1.5" />
            New Transfer
          </Button>
        </Link>
      </motion.div>

      {/* Summary Stats */}
      {transactions.length > 0 && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['pending', 'executed', 'failed', 'expired'] as const).map((status) => {
            const config = STATUS_CONFIG[status];
            const count = transactions.filter((tx) => tx.status === status).length;
            return (
              <div
                key={status}
                className="rounded-2xl border border-[#EDE9E3] bg-white p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}
                  >
                    <config.icon className={`w-3.5 h-3.5 ${config.text}`} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    {config.label}
                  </span>
                </div>
                <p className="text-[22px] font-bold text-[#2D3436] tracking-tight mt-1">{count}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-[#FDFBF8] py-16 flex flex-col items-center justify-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#EDE9E3]/60 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-[#B5B0AA]" />
          </div>
          <p className="text-[16px] font-semibold text-[#2D3436] mb-1">
            No scheduled transactions
          </p>
          <p className="text-[13px] text-[#9B9590] mb-5 text-center max-w-[280px]">
            Schedule a transfer to send tokens at a specific time in the future.
          </p>
          <Link to="/portal/send">
            <Button className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white">
              <Send className="w-4 h-4 mr-1.5" />
              Schedule a Transfer
            </Button>
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-3">
          {transactions.map((tx) => (
            <TransactionCard key={tx.id} transaction={tx} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

/** Individual transaction card */
function TransactionCard({ transaction }: { transaction: ScheduledTransaction }): ReactElement {
  const config = STATUS_CONFIG[transaction.status];
  const isPending = transaction.status === 'pending';
  const explorerUrl = transaction.txHash ? getExplorerTxUrl(transaction.txHash) : null;

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl border border-[#EDE9E3] bg-white p-5 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: status + details */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}
          >
            <config.icon className={`w-5 h-5 ${config.text}`} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Amount and token */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[16px] font-bold text-[#2D3436] tracking-tight">
                {formatAmount(transaction.amount, 6, 2)}
              </span>
              <span className="text-[13px] font-semibold text-[#9B9590]">
                {transaction.tokenSymbol}
              </span>
            </div>

            {/* Recipient */}
            <p className="text-[13px] text-[#6B6560] mt-0.5">
              To{' '}
              <span className="font-mono font-medium text-[#2D3436]">
                {formatAddress(transaction.to, 6)}
              </span>
            </p>

            {/* Memo */}
            {transaction.memo && (
              <p className="text-[12px] text-[#9B9590] mt-1 truncate">
                {transaction.memo}
              </p>
            )}

            {/* Timestamp info */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] text-[#B5B0AA]">
                Created {formatTimeAgo(new Date(transaction.createdAt).getTime() / 1000)}
              </span>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9B72CF] hover:text-[#8562BF] transition-colors"
                >
                  View on Explorer
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: status badge + countdown */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${config.bg} ${config.text} ${config.border} border`}
          >
            <config.icon className="w-3 h-3" />
            {config.label}
          </span>

          {isPending && (
            <div className="flex items-center gap-1.5 text-right">
              <Clock className="w-3.5 h-3.5 text-[#D4A056]" />
              <span className="text-[13px] font-semibold text-[#D4A056] tabular-nums">
                {formatCountdown(transaction.scheduledFor)}
              </span>
            </div>
          )}

          {!isPending && (
            <span className="text-[11px] text-[#B5B0AA]">
              {transaction.status === 'executed'
                ? 'Completed'
                : transaction.status === 'failed'
                  ? 'Transaction failed'
                  : 'Time elapsed'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
