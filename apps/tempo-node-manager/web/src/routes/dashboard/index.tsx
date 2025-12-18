import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { nodeApi, snapshotsApi } from '@/lib/api';
import { formatDuration, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Square,
  RotateCcw,
  Loader2,
  Server,
  Activity,
  Users,
  Network,
  Copy,
  Check,
  Download,
  AlertCircle,
  ScrollText,
  Settings,
  Clock,
  Cpu,
  Database,
} from 'lucide-react';
import { useState, type JSX } from 'react';
import type { NodeStatus } from '#types/index';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

// Quick actions with pastel colors matching gateway
const quickActions = [
  {
    icon: ScrollText,
    label: 'Logs',
    href: '/dashboard/logs',
    bgColor: '#E0E7FF',
    iconColor: '#7c5cff',
  },
  {
    icon: Download,
    label: 'Snapshots',
    href: '/dashboard/snapshots',
    bgColor: '#D1FAE5',
    iconColor: '#00a67e',
  },
  {
    icon: Settings,
    label: 'Settings',
    href: '/dashboard/settings',
    bgColor: '#FEF3C7',
    iconColor: '#f59e0b',
  },
];

function DashboardOverview(): JSX.Element {
  const queryClient = useQueryClient();

  // Fetch node status
  const { data: nodeInfo, isLoading: nodeLoading } = useQuery({
    queryKey: ['node-status'],
    queryFn: nodeApi.getStatus,
    refetchInterval: 5000,
  });

  // Fetch snapshot download status
  const { data: snapshotStatus } = useQuery({
    queryKey: ['snapshot-status'],
    queryFn: snapshotsApi.getStatus,
    refetchInterval: 3000,
  });

  // Start mutation
  const startMutation = useMutation({
    mutationFn: nodeApi.start,
    onSuccess: data => {
      if (data.success) {
        toast.success('Node started successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to start node'),
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: nodeApi.stop,
    onSuccess: data => {
      if (data.success) {
        toast.success('Node stopped successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to stop node'),
  });

  // Restart mutation
  const restartMutation = useMutation({
    mutationFn: nodeApi.restart,
    onSuccess: data => {
      if (data.success) {
        toast.success('Node restarted successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to restart node'),
  });

  // Snapshot download mutation
  const downloadSnapshotMutation = useMutation({
    mutationFn: snapshotsApi.download,
    onSuccess: data => {
      if (data.success) {
        toast.success('Snapshot downloaded! You can now start the node.');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to download snapshot'),
  });

  const isDownloading = snapshotStatus?.isDownloading || downloadSnapshotMutation.isPending;

  const isActionPending =
    startMutation.isPending || stopMutation.isPending || restartMutation.isPending || isDownloading;

  const status = nodeInfo?.status ?? 'unknown';
  const isRunning = status === 'running';
  const isStopped = status === 'stopped' || status === 'not_installed';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage your Tempo blockchain node</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => startMutation.mutate()}
            disabled={isActionPending || isRunning}
            size="sm"
            className={cn(
              'h-8',
              isStopped
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            {startMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Start
          </Button>
          <Button
            onClick={() => stopMutation.mutate()}
            disabled={isActionPending || !isRunning}
            size="sm"
            variant="outline"
            className="h-8 border-slate-200"
          >
            {stopMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Square className="w-3.5 h-3.5 mr-1.5" />
            )}
            Stop
          </Button>
          <Button
            onClick={() => restartMutation.mutate()}
            disabled={isActionPending || !isRunning}
            size="sm"
            variant="outline"
            className="h-8 border-slate-200"
          >
            {restartMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Restart
          </Button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Status & Sync */}
        <div className="lg:col-span-3 space-y-6">
          {/* Node Status Card */}
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Node Status
                    {nodeLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                  <div className="flex items-center gap-2.5 mb-3">
                    <StatusIndicator status={status} />
                    <span className="text-2xl font-bold text-gray-900 capitalize">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500">
                    {nodeInfo?.version ? `v${nodeInfo.version}` : 'Version unknown'}
                    {nodeInfo?.uptime ? ` • Uptime: ${formatDuration(nodeInfo.uptime)}` : ''}
                  </p>
                </div>
                <div
                  className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: isRunning ? '#D1FAE5' : '#F1F5F9' }}
                >
                  <Server
                    className="h-5 w-5"
                    style={{ color: isRunning ? '#00a67e' : '#64748b' }}
                  />
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            {!nodeLoading && nodeInfo && (
              <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                <StatItem
                  icon={<Clock className="w-4 h-4" />}
                  label="Uptime"
                  value={nodeInfo.uptime ? formatDuration(nodeInfo.uptime) : '-'}
                />
                <StatItem
                  icon={<Cpu className="w-4 h-4" />}
                  label="Container"
                  value={nodeInfo.containerId?.slice(0, 8) || '-'}
                  mono
                />
                <StatItem
                  icon={<Database className="w-4 h-4" />}
                  label="Version"
                  value={nodeInfo.version || '-'}
                  mono
                />
              </div>
            )}
          </div>

          {/* Sync Status Card */}
          {nodeInfo?.syncStatus && (
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  Sync Progress
                </h2>
                <span className="text-[12px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {nodeInfo.syncStatus.syncProgress}%
                </span>
              </div>
              <div className="p-4 space-y-4">
                <Progress value={nodeInfo.syncStatus.syncProgress} className="h-2" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                      Executed
                    </p>
                    <p className="text-[14px] font-mono font-medium text-gray-900">
                      {nodeInfo.syncStatus.currentBlock.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                      Target
                    </p>
                    <p className="text-[14px] font-mono font-medium text-gray-900">
                      {nodeInfo.syncStatus.highestBlock.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Peers
                    </p>
                    <p className="text-[14px] font-mono font-medium text-gray-900">
                      {nodeInfo.syncStatus.peerCount}
                    </p>
                  </div>
                </div>

                {/* Sync Stages */}
                {nodeInfo.syncStatus.stages && nodeInfo.syncStatus.stages.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                      Sync Stages
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {nodeInfo.syncStatus.stages
                        .filter(stage => ['Headers', 'Bodies', 'SenderRecovery', 'Execution'].includes(stage.name))
                        .map(stage => (
                          <div
                            key={stage.name}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                          >
                            <span className="text-[11px] text-gray-600">{stage.name}</span>
                            <span className="text-[11px] font-mono font-medium text-gray-900">
                              {stage.block.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Snapshot Download Card */}
          {(isDownloading ||
            isStopped ||
            (nodeInfo?.syncStatus && nodeInfo.syncStatus.syncProgress < 50)) && (
            <div
              className={cn(
                'bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden',
                isDownloading && 'ring-1 ring-emerald-200'
              )}
            >
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500" />
                )}
                <h2
                  className={cn(
                    'text-[13px] font-semibold',
                    isDownloading ? 'text-emerald-700' : 'text-gray-900'
                  )}
                >
                  {isDownloading
                    ? `Downloading Snapshot (${snapshotStatus?.progress ?? 0}%)`
                    : 'Speed Up Sync with Snapshot'}
                </h2>
              </div>
              <div className="p-4 space-y-4">
                {isDownloading && (
                  <div className="space-y-2">
                    <Progress value={snapshotStatus?.progress ?? 0} className="h-2" />
                    {snapshotStatus?.lastLog && (
                      <p className="text-[11px] text-gray-500 font-mono truncate bg-slate-50 p-2 rounded">
                        {snapshotStatus.lastLog}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    {isDownloading ? (
                      <div className="flex items-center gap-2 text-[12px] text-emerald-700">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Download in progress... Do not close this page.
                      </div>
                    ) : isRunning ? (
                      <div className="flex items-center gap-2 text-[12px] text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Stop the node first to download a snapshot
                      </div>
                    ) : (
                      <p className="text-[12px] text-gray-500">
                        Download a pre-synced snapshot to get running in ~30-60 minutes.
                      </p>
                    )}
                  </div>
                  {!isDownloading && (
                    <Button
                      onClick={() => downloadSnapshotMutation.mutate()}
                      disabled={isRunning || isDownloading}
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Connection Details */}
          {isRunning && nodeInfo?.config && (
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-slate-500" />
                <h2 className="text-[13px] font-semibold text-gray-900">Connection Details</h2>
              </div>
              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <ConnectionDetail
                    label="HTTP RPC Endpoint"
                    value={`http://localhost:${nodeInfo.config.httpPort}`}
                  />
                  <ConnectionDetail label="P2P Port" value={nodeInfo.config.p2pPort.toString()} />
                  <ConnectionDetail label="Data Directory" value={nodeInfo.config.dataDir} />
                  <ConnectionDetail
                    label="Enabled APIs"
                    value={nodeInfo.config.httpApis.join(', ')}
                  />
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">
                    Quick Connect
                  </p>
                  <code className="text-[12px] font-mono text-gray-700 break-all">
                    cast block-number --rpc-url http://localhost:{nodeInfo.config.httpPort}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map(action => (
                  <Link
                    key={action.label}
                    to={action.href}
                    className="group flex items-center gap-3 py-3 px-4 rounded-xl transition-all bg-slate-50 hover:bg-slate-100"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: action.bgColor }}
                    >
                      <action.icon className="h-5 w-5" style={{ color: action.iconColor }} />
                    </div>
                    <p className="text-[13px] font-medium text-gray-700">{action.label}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: NodeStatus | 'unknown' }): JSX.Element {
  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full',
        status === 'running' && 'bg-emerald-500 animate-pulse',
        status === 'stopped' && 'bg-gray-400',
        status === 'syncing' && 'bg-amber-500 animate-pulse',
        status === 'starting' && 'bg-blue-500 animate-pulse',
        status === 'stopping' && 'bg-orange-500 animate-pulse',
        status === 'error' && 'bg-red-500',
        status === 'not_installed' && 'bg-gray-300',
        status === 'unknown' && 'bg-gray-300'
      )}
    />
  );
}

function StatItem({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={cn('text-[14px] font-medium text-gray-900', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function ConnectionDetail({ label, value }: { label: string; value: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (): void => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[12px] font-mono text-gray-700 truncate">{value}</p>
      </div>
      <button
        onClick={copyToClipboard}
        className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors ml-2"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
