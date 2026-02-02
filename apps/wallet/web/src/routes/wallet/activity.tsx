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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  getActivity,
  clearActivity,
  getActivityTypeLabel,
  getActivityStatusColor,
} from '@/lib/activity';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatTimeAgo } from '@/lib/utils';
import type { ActivityItem, ActivityType, ActivityStatus } from '@/types';

export const Route = createFileRoute('/wallet/activity')({
  component: ActivityPage,
});

type FilterType = 'all' | ActivityType;

function getActivityIcon(type: ActivityType): typeof LinkIcon {
  switch (type) {
    case 'connect':
      return LinkIcon;
    case 'sign_message':
      return FileSignature;
    case 'send_payment':
    case 'send_scheduled_payment':
      return Send;
    case 'swap_tokens':
      return ArrowRightLeft;
    case 'add_liquidity':
    case 'remove_liquidity':
      return Droplets;
    case 'send_transaction':
      return Coins;
    default:
      return Coins;
  }
}

function getStatusIcon(status: ActivityStatus): typeof CheckCircle {
  switch (status) {
    case 'success':
      return CheckCircle;
    case 'failed':
      return XCircle;
    case 'rejected':
      return AlertTriangle;
    case 'timeout':
      return Clock;
    default:
      return CheckCircle;
  }
}

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
  };

  const filteredActivities =
    filter === 'all' ? activities : activities.filter(a => a.type === filter);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'send_payment', label: 'Payments' },
    { value: 'swap_tokens', label: 'Swaps' },
    { value: 'sign_message', label: 'Signatures' },
    { value: 'connect', label: 'Connections' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activities.length} transaction{activities.length !== 1 ? 's' : ''}
          </p>
        </div>
        {activities.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => setShowClearDialog(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      {activities.length > 0 && (
        <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                filter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No Activity Yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your transaction history will appear here after you connect to apps and sign
            transactions.
          </p>
        </motion.div>
      ) : filteredActivities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No Results</h2>
          <p className="text-sm text-muted-foreground">No activity matches the selected filter.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredActivities.map(activity => {
              const Icon = getActivityIcon(activity.type);
              const StatusIcon = getStatusIcon(activity.status);
              const statusColor = getActivityStatusColor(activity.status);

              return (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-border/50 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {getActivityTypeLabel(activity.type)}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs capitalize ${statusColor}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {activity.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{activity.appName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(activity.timestamp / 1000)}
                          </span>
                          {activity.txHash && (
                            <a
                              href={getExplorerTxUrl(activity.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              View tx
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {activity.details && Object.keys(activity.details).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex flex-wrap gap-2">
                          {activity.details.amount !== undefined ? (
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              Amount: {`${activity.details.amount}`}
                            </span>
                          ) : null}
                          {activity.details.to ? (
                            <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              To: {`${activity.details.to}`.slice(0, 8)}...
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Clear Activity</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all activity history? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowClearDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleClear}>
                Clear All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
