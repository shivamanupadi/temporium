import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  ExternalLink,
  FileSignature,
  Send,
  ArrowRightLeft,
  Droplets,
  Link as LinkIcon,
  Coins,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Filter,
  ShoppingCart,
  ListOrdered,
  Ban,
  GitBranch,
  ShieldCheck,
  Sparkles,
  CirclePlus,
  Flame,
  Gift,
  ArrowUpFromLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { getActivity, clearActivity, getActivityTypeLabel } from '@/lib/activity';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatTimeAgo, formatAddress, cn } from '@/lib/utils';
import type { ActivityItem, ActivityType, ActivityStatus } from '@/types';

export const Route = createFileRoute('/wallet/activity')({
  component: ActivityPage,
});

type FilterType = 'all' | ActivityType;

interface ActivityMeta {
  icon: typeof LinkIcon;
  color: string;
}

function getActivityMeta(type: ActivityType): ActivityMeta {
  switch (type) {
    case 'connect':
      return { icon: LinkIcon, color: '#5B9A6F' };
    case 'sign_message':
      return { icon: FileSignature, color: '#9B72CF' };
    case 'send_payment':
    case 'send_scheduled_payment':
      return { icon: Send, color: '#9B72CF' };
    case 'swap_tokens':
      return { icon: ArrowRightLeft, color: '#9B72CF' };
    case 'add_liquidity':
    case 'remove_liquidity':
      return { icon: Droplets, color: '#5B9A6F' };
    case 'send_transaction':
      return { icon: Coins, color: '#9B72CF' };
    case 'buy_tokens':
      return { icon: ShoppingCart, color: '#9B72CF' };
    case 'place_order':
      return { icon: ListOrdered, color: '#9B72CF' };
    case 'cancel_order':
      return { icon: Ban, color: '#9B72CF' };
    case 'create_pair':
      return { icon: GitBranch, color: '#9B72CF' };
    case 'approve_token':
      return { icon: ShieldCheck, color: '#5B9A6F' };
    case 'create_token':
      return { icon: Sparkles, color: '#5B9A6F' };
    case 'mint_token':
      return { icon: CirclePlus, color: '#5B9A6F' };
    case 'burn_token':
      return { icon: Flame, color: '#9B72CF' };
    case 'claim_rewards':
      return { icon: Gift, color: '#5B9A6F' };
    case 'dex_withdraw':
      return { icon: ArrowUpFromLine, color: '#9B72CF' };
    default:
      return { icon: Coins, color: '#6B6560' };
  }
}

interface StatusMeta {
  icon: typeof CheckCircle;
  color: string;
  bg: string;
  label: string;
}

function getStatusMeta(status: ActivityStatus): StatusMeta {
  switch (status) {
    case 'success':
      return { icon: CheckCircle, color: '#5B9A6F', bg: '#5B9A6F10', label: 'Success' };
    case 'failed':
      return { icon: XCircle, color: '#E5484D', bg: '#E5484D10', label: 'Failed' };
    case 'rejected':
      return { icon: AlertTriangle, color: '#D97706', bg: '#D9770610', label: 'Rejected' };
    case 'timeout':
      return { icon: Clock, color: '#9B9590', bg: '#9B959010', label: 'Timeout' };
    default:
      return { icon: CheckCircle, color: '#9B9590', bg: '#9B959010', label: status };
  }
}

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'send_payment', label: 'Payments' },
  { value: 'swap_tokens', label: 'Swaps' },
  { value: 'sign_message', label: 'Signatures' },
  { value: 'connect', label: 'Connections' },
  { value: 'place_order', label: 'Orders' },
  { value: 'approve_token', label: 'Approvals' },
  { value: 'claim_rewards', label: 'Rewards' },
];

function ActivityPage(): ReactElement {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    const loadActivities = (): void => {
      const items = getActivity();
      setActivities(items);
    };

    loadActivities();

    const handleStorage = (e: StorageEvent): void => {
      if (e.key === 'temporium_activity') {
        loadActivities();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleClear = (): void => {
    clearActivity();
    setActivities([]);
    setShowClearDialog(false);
    toast.success('Activity history cleared');
  };

  const filteredActivities =
    filter === 'all' ? activities : activities.filter(a => a.type === filter);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Activity</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            {activities.length === 0
              ? 'No transactions yet'
              : `${activities.length} transaction${activities.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {activities.length > 0 && (
          <button
            onClick={() => setShowClearDialog(true)}
            className="w-8 h-8 rounded-lg border border-border/30 hover:border-red-200 bg-[#FDFBF8] hover:bg-red-50 flex items-center justify-center transition-all group"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#B5B0AA] group-hover:text-red-500 transition-colors" />
          </button>
        )}
      </motion.div>

      {/* Filter tabs */}
      {activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex gap-1.5 overflow-x-auto py-0.5 scrollbar-hide"
        >
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                'px-3.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all border',
                filter === option.value
                  ? 'bg-[#2D3436] text-white border-[#2D3436]'
                  : 'bg-white text-[#6B6560] border-border/40 hover:border-border/60 hover:bg-[#FDFBF8]'
              )}
            >
              {option.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Content */}
      {activities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <History className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Activity Yet</h2>
            <p className="text-[13px] text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              Your transaction history will appear here after you connect to apps and sign
              transactions.
            </p>
          </div>
        </motion.div>
      ) : filteredActivities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
              <Filter className="w-7 h-7 text-[#9B9590]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Results</h2>
            <p className="text-[13px] text-muted-foreground">
              No activity matches the selected filter.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="popLayout">
            {filteredActivities.map((activity, index) => {
              const meta = getActivityMeta(activity.type);
              const status = getStatusMeta(activity.status);
              const Icon = meta.icon;
              const StatusIcon = status.icon;
              const isLast = index === filteredActivities.length - 1;
              const hasAmount = activity.details?.amount !== undefined;
              const hasTo = !!activity.details?.to;

              return (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className={cn(
                    'px-6 py-4 hover:bg-[#FDFBF8] transition-colors',
                    !isLast && 'border-b border-border/20'
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Activity icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.color}12` }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[14px] font-semibold text-[#2D3436] truncate">
                          {getActivityTypeLabel(activity.type)}
                        </h3>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {status.label}
                        </span>
                      </div>

                      <p className="text-[12px] text-[#9B9590] truncate mb-1.5">
                        {activity.appName}
                      </p>

                      {/* Details row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasAmount && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/8 text-[10px] font-semibold text-primary">
                            <Coins className="w-2.5 h-2.5" />
                            {`${activity.details!.amount}`}
                          </span>
                        )}
                        {hasTo && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F5F2ED] text-[10px] font-mono text-[#6B6560]">
                            {formatAddress(`${activity.details!.to}`, 4)}
                          </span>
                        )}
                        {activity.txHash && (
                          <a
                            href={getExplorerTxUrl(activity.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-[#5B9A6F] hover:bg-[#5B9A6F]/8 transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View tx
                          </a>
                        )}

                        <span className="text-[10px] text-[#B5B0AA] flex items-center gap-1 ml-auto shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(activity.timestamp / 1000)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-[320px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Clear Activity</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm clearing all activity history
          </DialogDescription>

          <div className="relative px-6 pt-8 pb-5 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.04] to-transparent pointer-events-none" />

            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>

              <h3 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">Clear Activity?</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                This will permanently remove all{' '}
                <span className="font-semibold text-[#2D3436]">{activities.length}</span>{' '}
                transaction{activities.length !== 1 ? 's' : ''} from your history.
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
              onClick={() => setShowClearDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
              onClick={handleClear}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
