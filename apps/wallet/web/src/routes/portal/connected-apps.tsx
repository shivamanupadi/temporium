import { type ReactElement, useState, useEffect, useCallback, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Link2,
  Trash2,
  ExternalLink,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Globe,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { getConnectedApps, removeConnectedApp } from '@/lib/connected-apps';
import {
  getActivity,
  clearActivity,
  getActivityTypeLabel,
  getActivityStatusColor,
} from '@/lib/activity';
import { LINKS } from '@/lib/constants';
import { formatAddress } from '@/lib/utils';
import type { ConnectedApp, ActivityItem } from '@/types';

export const Route = createFileRoute('/portal/connected-apps')({
  component: ConnectedAppsPage,
});

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getStatusIcon(status: string): ReactElement {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-[#5B9A6F]" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case 'rejected':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    case 'timeout':
      return <Timer className="w-3.5 h-3.5 text-[#B5B0AA]" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-[#B5B0AA]" />;
  }
}

function getPermissionColor(perm: string): string {
  switch (perm) {
    case 'connect':
      return 'bg-[#5B9A6F]/8 text-[#5B9A6F]';
    case 'sign':
      return 'bg-[#9B72CF]/8 text-[#9B72CF]';
    case 'send':
      return 'bg-[#E07A5F]/8 text-[#E07A5F]';
    default:
      return 'bg-[#F5F2ED] text-[#6B6560]';
  }
}

function ConnectedAppsPage(): ReactElement {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [revokeTarget, setRevokeTarget] = useState<ConnectedApp | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activityVisible, setActivityVisible] = useState(15);

  const PAGE_SIZE = 15;

  const uniqueAppNames = useMemo(
    () => [...new Set(activity.map(a => a.appName))].sort(),
    [activity]
  );

  const filteredActivity = useMemo(
    () =>
      activityFilter === 'all' ? activity : activity.filter(a => a.appName === activityFilter),
    [activity, activityFilter]
  );

  const visibleActivity = filteredActivity.slice(0, activityVisible);
  const hasMore = activityVisible < filteredActivity.length;

  const refresh = useCallback(() => {
    setApps(getConnectedApps());
    setActivity(getActivity());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRevoke = (): void => {
    if (!revokeTarget) return;
    removeConnectedApp(revokeTarget.id);
    setRevokeTarget(null);
    refresh();
  };

  const handleClearActivity = (): void => {
    clearActivity();
    setShowClearConfirm(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-[#2D3436]">Connected Apps</h1>
        <p className="text-[13px] text-[#9B9590] mt-1">
          Manage apps connected to your wallet and view activity history
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="apps">
        <TabsList className="bg-[#F5F2ED] rounded-xl p-1">
          <TabsTrigger
            value="apps"
            className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Apps
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Apps Tab */}
        <TabsContent value="apps" className="mt-4">
          {apps.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#EDE9E3] rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3">
                <Link2 className="w-5 h-5 text-[#9B9590]" />
              </div>
              <p className="text-[14px] font-medium text-[#2D3436]">No connected apps</p>
              <p className="text-[13px] text-[#9B9590] mt-1">
                Apps that connect to your wallet will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map(app => (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-[#EDE9E3] p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3.5">
                    {/* App Icon */}
                    <div className="w-11 h-11 rounded-xl bg-[#9B72CF]/8 flex items-center justify-center overflow-hidden shrink-0">
                      {app.icon ? (
                        <img
                          src={app.icon}
                          alt={app.name}
                          className="w-11 h-11 rounded-xl object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Globe className="w-5 h-5 text-[#9B72CF]" />
                      )}
                    </div>

                    {/* App Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-[14px] font-semibold text-[#2D3436] truncate">
                            {app.name}
                          </h3>
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[#B5B0AA] hover:text-[#6B6560] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <button
                          onClick={() => setRevokeTarget(app)}
                          className="shrink-0 p-1.5 rounded-lg text-[#B5B0AA] hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[12px] text-[#9B9590] font-mono truncate mt-0.5">
                        {app.url}
                      </p>

                      {app.description && (
                        <p className="text-[12px] text-[#6B6560] mt-1.5 line-clamp-1">
                          {app.description}
                        </p>
                      )}

                      {/* Permissions + Last used */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5">
                          {app.permissions.map(perm => (
                            <span
                              key={perm}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize ${getPermissionColor(perm)}`}
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#B5B0AA]">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(app.lastUsedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          {activity.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#EDE9E3] rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3">
                <Activity className="w-5 h-5 text-[#9B9590]" />
              </div>
              <p className="text-[14px] font-medium text-[#2D3436]">No activity yet</p>
              <p className="text-[13px] text-[#9B9590] mt-1">
                Transactions and signing requests will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Toolbar: filter + clear */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-[#B5B0AA]" />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setActivityFilter('all');
                        setActivityVisible(PAGE_SIZE);
                      }}
                      className={`text-[12px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        activityFilter === 'all'
                          ? 'bg-[#2D3436] text-white'
                          : 'text-[#9B9590] hover:bg-[#F5F2ED]'
                      }`}
                    >
                      All
                    </button>
                    {uniqueAppNames.map(name => (
                      <button
                        key={name}
                        onClick={() => {
                          setActivityFilter(name);
                          setActivityVisible(PAGE_SIZE);
                        }}
                        className={`text-[12px] px-2.5 py-1 rounded-lg font-medium transition-colors truncate max-w-[120px] ${
                          activityFilter === name
                            ? 'bg-[#2D3436] text-white'
                            : 'text-[#9B9590] hover:bg-[#F5F2ED]'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[12px] text-[#9B9590] hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Clear all
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-[#EDE9E3] overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-3 border-b border-[#EDE9E3]/60">
                  <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                    Action
                  </span>
                  <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                    App
                  </span>
                  <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                    Status
                  </span>
                  <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider text-right">
                    Time
                  </span>
                </div>

                {/* Rows */}
                {filteredActivity.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-[13px] text-[#9B9590]">No activity for this app</p>
                  </div>
                ) : (
                  visibleActivity.map((item, index) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-3.5 items-center hover:bg-[#FDFBF8] transition-colors ${
                        index < visibleActivity.length - 1 ? 'border-b border-[#EDE9E3]/40' : ''
                      }`}
                    >
                      {/* Action + tx hash */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0">{getStatusIcon(item.status)}</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#2D3436] truncate">
                            {getActivityTypeLabel(item.type)}
                          </p>
                          {item.txHash && (
                            <a
                              href={`${LINKS.explorer}/tx/${item.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#E07A5F] hover:underline font-mono inline-flex items-center gap-1"
                            >
                              {formatAddress(item.txHash, 6)}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* App */}
                      <span className="text-[12px] text-[#9B9590] truncate">{item.appName}</span>

                      {/* Status */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize w-fit ${getActivityStatusColor(item.status)}`}
                      >
                        {item.status}
                      </span>

                      {/* Time */}
                      <span className="text-[11px] text-[#B5B0AA] text-right">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  ))
                )}

                {/* Load more */}
                {hasMore && (
                  <button
                    onClick={() => setActivityVisible(v => v + PAGE_SIZE)}
                    className="w-full px-5 py-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#9B9590] hover:text-[#6B6560] hover:bg-[#FDFBF8] transition-colors border-t border-[#EDE9E3]/40"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Load more ({filteredActivity.length - activityVisible} remaining)
                  </button>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Revoke Confirm Dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={open => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-semibold text-[#2D3436] mb-2">
              Revoke Access
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590]">
              Are you sure you want to revoke access for{' '}
              <strong className="text-[#2D3436]">{revokeTarget?.name}</strong>? The app will need to
              reconnect to interact with your wallet.
            </DialogDescription>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setRevokeTarget(null)}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-[#6B6560] bg-[#F5F2ED] hover:bg-[#EDE9E3] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRevoke}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Revoke
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Activity Confirm Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-semibold text-[#2D3436] mb-2">
              Clear Activity
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590]">
              Are you sure you want to clear all activity history? This action cannot be undone.
            </DialogDescription>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-[#6B6560] bg-[#F5F2ED] hover:bg-[#EDE9E3] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearActivity}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Clear All
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
