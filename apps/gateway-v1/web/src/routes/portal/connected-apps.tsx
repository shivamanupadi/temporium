import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Link2,
  Trash2,
  ExternalLink,
  Shield,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Globe,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@temporium/shared-ui';
import { getConnectedApps, removeConnectedApp } from '@/lib/connected-apps';
import { getActivity, clearActivity, getActivityTypeLabel, getActivityStatusColor } from '@/lib/activity';
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
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    case 'rejected':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    case 'timeout':
      return <Timer className="w-3.5 h-3.5 text-gray-500" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-gray-500" />;
  }
}

function ConnectedAppsPage(): ReactElement {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [revokeTarget, setRevokeTarget] = useState<ConnectedApp | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
            {apps.length > 0 && (
              <span className="ml-1.5 text-[11px] bg-[#E07A5F]/10 text-[#E07A5F] px-1.5 py-0.5 rounded-full font-medium">
                {apps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Activity
            {activity.length > 0 && (
              <span className="ml-1.5 text-[11px] bg-[#9B9590]/10 text-[#9B9590] px-1.5 py-0.5 rounded-full font-medium">
                {activity.length}
              </span>
            )}
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
                  className="bg-white border border-[#EDE9E3] rounded-2xl p-4 hover:border-[#DDD8D1] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* App Icon */}
                    <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {app.icon ? (
                        <img
                          src={app.icon}
                          alt={app.name}
                          className="w-10 h-10 rounded-xl object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML =
                              '<svg class="w-5 h-5 text-[#9B9590]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
                          }}
                        />
                      ) : (
                        <Globe className="w-5 h-5 text-[#9B9590]" />
                      )}
                    </div>

                    {/* App Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-[#2D3436] truncate">
                          {app.name}
                        </h3>
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-[#9B9590] hover:text-[#6B6560] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <p className="text-[12px] text-[#9B9590] truncate mt-0.5">
                        {app.url}
                      </p>

                      {app.description && (
                        <p className="text-[12px] text-[#6B6560] mt-1 line-clamp-1">
                          {app.description}
                        </p>
                      )}

                      {/* Permissions & Timestamps */}
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        {/* Permissions */}
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-[#B5B0AA]" />
                          <div className="flex gap-1">
                            {app.permissions.map(perm => (
                              <span
                                key={perm}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F2ED] text-[#6B6560] font-medium capitalize"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Last Used */}
                        <div className="flex items-center gap-1 text-[11px] text-[#B5B0AA]">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(app.lastUsedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Revoke Button */}
                    <button
                      onClick={() => setRevokeTarget(app)}
                      className="flex-shrink-0 p-2 rounded-lg text-[#B5B0AA] hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
              {/* Clear All */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[12px] text-[#9B9590] hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Clear all
                </button>
              </div>

              {/* Activity List */}
              <div className="bg-white border border-[#EDE9E3] rounded-2xl divide-y divide-[#EDE9E3]">
                {activity.map(item => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-[#FDFBF8] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>

                    {/* Activity Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#2D3436]">
                          {getActivityTypeLabel(item.type)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${getActivityStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#9B9590] truncate">
                          {item.appName}
                        </span>
                        {item.txHash && (
                          <>
                            <span className="text-[#EDE9E3]">&middot;</span>
                            <a
                              href={`${LINKS.explorer}/tx/${item.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#E07A5F] hover:underline font-mono flex items-center gap-1"
                            >
                              {formatAddress(item.txHash, 6)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-[11px] text-[#B5B0AA]">
                      {formatRelativeTime(item.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Revoke Confirm Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}>
        <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900 mb-2">
              Revoke Access
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Are you sure you want to revoke access for{' '}
              <strong className="text-gray-700">{revokeTarget?.name}</strong>? The app
              will need to reconnect to interact with your wallet.
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
            <DialogTitle className="text-lg font-semibold text-gray-900 mb-2">
              Clear Activity
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
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
