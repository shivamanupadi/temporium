import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { nodeApi, systemApi } from '@/lib/api';
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
  Clock,
  Cpu,
  Database,
  X,
  HardDrive,
  CheckCircle2,
  MemoryStick,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState, useEffect, useRef, type JSX, type ReactNode } from 'react';
import type { NodeStatus } from '#types/index';

type ConfirmAction = 'start' | 'stop' | 'restart' | 'delete' | null;

export const Route = createFileRoute('/portal/dashboard')({
  component: DashboardPage,
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function DashboardPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [autoStartAfterDownload, setAutoStartAfterDownload] = useState(false);

  // Fetch node status
  const { data: nodeInfo, isLoading: nodeLoading } = useQuery({
    queryKey: ['node-status'],
    queryFn: nodeApi.getStatus,
    refetchInterval: 5000,
  });

  // Fetch snapshot download status
  const { data: snapshotStatus } = useQuery({
    queryKey: ['snapshot-status'],
    queryFn: nodeApi.getSnapshotStatus,
    refetchInterval: 3000,
  });

  // Fetch system info
  const { data: systemInfo } = useQuery({
    queryKey: ['system-info'],
    queryFn: systemApi.getInfo,
    refetchInterval: 10000,
  });

  // Start mutation
  const startMutation = useMutation({
    mutationFn: nodeApi.start,
    onSuccess: data => {
      setConfirmAction(null);
      if (data.success) {
        toast.success('Node started successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      setConfirmAction(null);
      toast.error('Failed to start node');
    },
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: nodeApi.stop,
    onSuccess: data => {
      setConfirmAction(null);
      if (data.success) {
        toast.success('Node stopped successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      setConfirmAction(null);
      toast.error('Failed to stop node');
    },
  });

  // Restart mutation
  const restartMutation = useMutation({
    mutationFn: nodeApi.restart,
    onSuccess: data => {
      setConfirmAction(null);
      if (data.success) {
        toast.success('Node restarted successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      setConfirmAction(null);
      toast.error('Failed to restart node');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: nodeApi.deleteContainer,
    onSuccess: data => {
      setConfirmAction(null);
      if (data.success) {
        toast.success('Container deleted successfully');
        queryClient.invalidateQueries({ queryKey: ['node-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      setConfirmAction(null);
      toast.error('Failed to delete container');
    },
  });

  // Snapshot download mutation
  const downloadSnapshotMutation = useMutation({
    mutationFn: nodeApi.downloadSnapshot,
    onSuccess: data => {
      if (data.success) {
        toast.success('Snapshot download started');
        queryClient.invalidateQueries({ queryKey: ['snapshot-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to start snapshot download'),
  });

  const isDownloading = snapshotStatus?.isDownloading || downloadSnapshotMutation.isPending;
  const prevIsDownloading = useRef(isDownloading);

  // Auto-start node after snapshot download completes
  useEffect(() => {
    if (
      prevIsDownloading.current &&
      !isDownloading &&
      autoStartAfterDownload &&
      snapshotStatus?.snapshot?.exists
    ) {
      setAutoStartAfterDownload(false);
      toast.success('Snapshot download completed. Starting node...');
      startMutation.mutate();
    }
    prevIsDownloading.current = isDownloading;
  }, [isDownloading, autoStartAfterDownload, snapshotStatus?.snapshot?.exists, startMutation]);

  const isActionPending =
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending ||
    deleteMutation.isPending ||
    isDownloading;

  const status = nodeInfo?.status ?? 'unknown';
  const isRunning = status === 'running';
  const isStopped = status === 'stopped' || status === 'not_installed';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
            <p className="text-[12px] sm:text-[13px] text-slate-500">Manage your Tempo blockchain node</p>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <Link
              to="/status"
              target="_blank"
              className="text-[12px] sm:text-[13px] text-[#7c5cff] hover:text-[#6b4fee] flex items-center gap-1 transition-colors"
            >
              Public Status
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setConfirmAction('start')}
            disabled={isActionPending || isRunning}
            size="sm"
            className={cn(
              'h-8 flex-1 sm:flex-none',
              isStopped
                ? 'bg-[#10b981] hover:bg-[#059669] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Start
          </Button>
          <Button
            onClick={() => setConfirmAction('stop')}
            disabled={isActionPending || !isRunning}
            size="sm"
            variant="outline"
            className="h-8 flex-1 sm:flex-none border-slate-200"
          >
            <Square className="w-3.5 h-3.5 mr-1.5" />
            Stop
          </Button>
          <Button
            onClick={() => setConfirmAction('restart')}
            disabled={isActionPending || !isRunning}
            size="sm"
            variant="outline"
            className="h-8 flex-1 sm:flex-none border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Restart
          </Button>
          <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 self-center" />
          <Button
            onClick={() => setConfirmAction('delete')}
            disabled={isActionPending || isRunning}
            size="sm"
            variant="ghost"
            className="h-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
                  <div className="flex items-center gap-2.5">
                    <StatusIndicator status={status} />
                    <span className="text-2xl font-bold text-gray-900 capitalize">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
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
              <div className="border-t border-gray-100 grid grid-cols-1 xs:grid-cols-3 divide-y xs:divide-y-0 xs:divide-x divide-gray-100">
                <StatItem
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Uptime"
                  value={nodeInfo.uptime ? formatDuration(nodeInfo.uptime) : '-'}
                  iconBg="#DBEAFE"
                  iconColor="#3b82f6"
                />
                <StatItem
                  icon={<Cpu className="w-3.5 h-3.5" />}
                  label="Container"
                  value={nodeInfo.containerId?.slice(0, 8) || '-'}
                  mono
                  iconBg="#E0E7FF"
                  iconColor="#7c5cff"
                />
                <StatItem
                  icon={<Database className="w-3.5 h-3.5" />}
                  label="Version"
                  value={nodeInfo.version || '-'}
                  mono
                  iconBg="#D1FAE5"
                  iconColor="#10b981"
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
                  Blockchain Sync
                </h2>
                <span className="text-[12px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {nodeInfo.syncStatus.syncProgress}%
                </span>
              </div>
              <div className="p-4 space-y-4">
                <Progress value={nodeInfo.syncStatus.syncProgress} className="h-2" />

                {/* Show note when uptime < 6 hours and not fully synced */}
                {nodeInfo.uptime &&
                  nodeInfo.uptime < 6 * 60 * 60 &&
                  nodeInfo.syncStatus.syncProgress < 100 && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-blue-700">
                        The node was recently started. It may take a few hours to catch up with the
                        latest blocks. This is normal behavior.
                      </p>
                    </div>
                  )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                      Current Block
                    </p>
                    <AnimatedNumber value={nodeInfo.syncStatus.currentBlock} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                      {nodeInfo.syncStatus.isSynced ? 'Latest' : 'Target'}
                    </p>
                    <p className="text-[13px] sm:text-[14px] font-mono font-medium text-gray-900">
                      {nodeInfo.syncStatus.highestBlock.toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Peers
                    </p>
                    <p className="text-[13px] sm:text-[14px] font-mono font-medium text-gray-900">
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
                        .filter(stage =>
                          ['Headers', 'Bodies', 'SenderRecovery', 'Execution'].includes(stage.name)
                        )
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

          {/* Snapshot Card */}
          {(isDownloading ||
            isStopped ||
            snapshotStatus?.snapshot?.exists ||
            (nodeInfo?.syncStatus && nodeInfo.syncStatus.syncProgress < 50)) && (
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Downloading State - Full card redesign */}
              {isDownloading ? (
                <div className="p-6">
                  {/* Header with animated icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-[#7c5cff]/10 flex items-center justify-center">
                          <Download className="w-5 h-5 text-[#7c5cff]" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#7c5cff] rounded-full animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-semibold text-gray-900">
                          Downloading Snapshot
                        </h2>
                        <p className="text-[12px] text-gray-500">Please keep this page open</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[24px] font-bold text-[#7c5cff] tabular-nums">
                        {snapshotStatus?.progress ?? 0}%
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#7c5cff] to-[#9f7eff] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${snapshotStatus?.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Status log */}
                  {snapshotStatus?.lastLog && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Loader2 className="w-3.5 h-3.5 text-[#7c5cff] animate-spin flex-shrink-0" />
                      <p className="text-[12px] text-gray-600 font-mono truncate">
                        {snapshotStatus.lastLog}
                      </p>
                    </div>
                  )}

                  {/* Auto-start indicator */}
                  {autoStartAfterDownload && (
                    <div className="mt-4 flex items-center gap-2 text-[12px] text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Node will start automatically when download completes
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Normal state header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {snapshotStatus?.snapshot?.exists ? (
                        <HardDrive className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Download className="w-4 h-4 text-slate-500" />
                      )}
                      <h2 className="text-[13px] font-semibold text-gray-900">
                        {snapshotStatus?.snapshot?.exists
                          ? 'Snapshot Data'
                          : 'Speed Up Sync with Snapshot'}
                      </h2>
                    </div>
                    {snapshotStatus?.snapshot?.exists && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Available
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Snapshot exists - show info */}
                    {snapshotStatus?.snapshot?.exists && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">
                            Size
                          </p>
                          <p className="text-[14px] font-medium text-gray-900">
                            {snapshotStatus.snapshot.sizeFormatted}
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">
                            Last Updated
                          </p>
                          <p className="text-[14px] font-medium text-gray-900">
                            {snapshotStatus.snapshot.lastModified
                              ? new Date(snapshotStatus.snapshot.lastModified).toLocaleDateString()
                              : '-'}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        {isRunning ? (
                          <div className="flex items-center gap-2 text-[12px] text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Stop the node first to download a new snapshot
                          </div>
                        ) : snapshotStatus?.snapshot?.exists ? (
                          <p className="text-[12px] text-gray-500">
                            Re-download to get the latest snapshot data.
                          </p>
                        ) : (
                          <p className="text-[12px] text-gray-500">
                            Download a pre-synced snapshot to get running in ~30-60 minutes.
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => downloadSnapshotMutation.mutate()}
                        disabled={isRunning || isDownloading}
                        size="sm"
                        className="h-8 bg-[#7c5cff] hover:bg-[#6b4fee] text-white"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        {snapshotStatus?.snapshot?.exists ? 'Re-download' : 'Download'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Connection Details */}
          {isRunning && nodeInfo?.config && (
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-slate-400" />
                <h2 className="text-[13px] font-semibold text-gray-900">RPC Endpoints</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* Endpoints */}
                <div className="space-y-2">
                  {(() => {
                    const host = systemInfo?.network?.host || 'localhost';
                    return (
                      <>
                        <EndpointRow
                          protocol="HTTP"
                          url={`http://${host}:${nodeInfo.config.httpPort}`}
                          color="#3b82f6"
                        />
                        <EndpointRow
                          protocol="WS"
                          url={`ws://${host}:${nodeInfo.config.wsPort}`}
                          color="#7c5cff"
                        />
                      </>
                    );
                  })()}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100" />

                {/* Config Details */}
                <div className="space-y-3">
                  <ConfigRow label="P2P Port" value={nodeInfo.config.p2pPort.toString()} mono />
                  <ConfigRow label="Data Directory" value={nodeInfo.config.dataDir} mono />
                  <ConfigRow
                    label="Enabled APIs"
                    value={
                      <div className="flex flex-wrap gap-1.5">
                        {nodeInfo.config.httpApis.map(api => (
                          <span
                            key={api}
                            className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded"
                          >
                            {api}
                          </span>
                        ))}
                      </div>
                    }
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100" />

                {/* Quick Connect */}
                <div>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Quick Test
                  </p>
                  {(() => {
                    const host = systemInfo?.network?.host || 'localhost';
                    const cmd = `cast block-number --rpc-url http://${host}:${nodeInfo.config.httpPort}`;
                    return (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <code className="flex-1 text-[12px] font-mono text-gray-600 break-all">
                          {cmd}
                        </code>
                        <CopyButton value={cmd} />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - System Information */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold text-gray-900">System</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {/* CPU */}
              <div className="p-4 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#DBEAFE' }}
                >
                  <Cpu className="h-5 w-5" style={{ color: '#3b82f6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                    CPU
                  </p>
                  <p className="text-[15px] font-semibold text-gray-900 mt-0.5">
                    {systemInfo?.cpu.cores ?? '-'} Cores
                  </p>
                </div>
              </div>

              {/* Memory */}
              <div className="p-4 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E0E7FF' }}
                >
                  <MemoryStick className="h-5 w-5" style={{ color: '#7c5cff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                    Memory
                  </p>
                  <p className="text-[15px] font-semibold text-gray-900 mt-0.5">
                    {formatBytes(systemInfo?.memory.total ?? 0)}
                  </p>
                </div>
              </div>

              {/* Storage */}
              <div className="p-4 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#D1FAE5' }}
                >
                  <HardDrive className="h-5 w-5" style={{ color: '#10b981' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                      Storage
                    </p>
                    <p className="text-[11px] font-semibold text-gray-600">
                      {systemInfo?.storage.usagePercent ?? 0}%
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${systemInfo?.storage.usagePercent ?? 0}%`,
                        backgroundColor: '#10b981',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    {formatBytes(systemInfo?.storage.used ?? 0)} of{' '}
                    {formatBytes(systemInfo?.storage.total ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmActionModal
        action={confirmAction}
        isPending={
          startMutation.isPending ||
          stopMutation.isPending ||
          restartMutation.isPending ||
          deleteMutation.isPending ||
          downloadSnapshotMutation.isPending
        }
        snapshotExists={snapshotStatus?.snapshot?.exists ?? false}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === 'start') {
            setConfirmAction(null);
            // Auto-download snapshot if not available, then start
            if (!snapshotStatus?.snapshot?.exists) {
              setAutoStartAfterDownload(true);
              downloadSnapshotMutation.mutate();
            } else {
              startMutation.mutate();
            }
          } else if (confirmAction === 'stop') stopMutation.mutate();
          else if (confirmAction === 'restart') restartMutation.mutate();
          else if (confirmAction === 'delete') deleteMutation.mutate();
        }}
      />
    </div>
  );
}

function ConfirmActionModal({
  action,
  isPending,
  snapshotExists,
  onClose,
  onConfirm,
}: {
  action: ConfirmAction;
  isPending: boolean;
  snapshotExists: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element | null {
  const handleClose = (): void => {
    if (!isPending) {
      onClose();
    }
  };

  const actionConfig = {
    start: {
      title: snapshotExists ? 'Start Node' : 'Download & Start',
      description: snapshotExists
        ? 'Are you sure you want to start the node?'
        : 'No snapshot data found. Download snapshot first?',
      info: snapshotExists
        ? 'The node will begin syncing with the Tempo blockchain network.'
        : 'A snapshot will be downloaded (~30-60 min) to speed up initial sync. The node will start automatically after download completes.',
      buttonText: snapshotExists ? 'Start' : 'Download & Start',
      buttonColor: 'bg-[#10b981] hover:bg-[#059669]',
      icon: snapshotExists ? Play : Download,
      iconBg: snapshotExists ? 'bg-emerald-50' : 'bg-violet-50',
      iconColor: snapshotExists ? 'text-emerald-600' : 'text-violet-600',
    },
    stop: {
      title: 'Stop Node',
      description: 'Are you sure you want to stop the node?',
      info: 'The node will stop syncing. You can restart it anytime.',
      buttonText: 'Stop',
      buttonColor: 'bg-red-500 hover:bg-red-600',
      icon: Square,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
    },
    restart: {
      title: 'Restart Node',
      description: 'Are you sure you want to restart the node?',
      info: 'The node will stop and start again. This may take a moment.',
      buttonText: 'Restart',
      buttonColor: 'bg-amber-500 hover:bg-amber-600',
      icon: RotateCcw,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    delete: {
      title: 'Delete Container',
      description: 'Are you sure you want to delete the container?',
      info: 'This will remove the container but keep your data and snapshot intact. You can start a fresh container anytime.',
      buttonText: 'Delete',
      buttonColor: 'bg-red-500 hover:bg-red-600',
      icon: Trash2,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  };

  const config = action ? actionConfig[action] : null;
  const Icon = config?.icon;

  return (
    <AnimatePresence>
      {action && config && Icon && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[360px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        config.iconBg
                      )}
                    >
                      <Icon className={cn('w-5 h-5', config.iconColor)} />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isPending}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-[13px] text-gray-500">{config.description}</p>
              </div>

              {/* Info */}
              <div className="px-6 pb-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[13px] text-slate-600">{config.info}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="
                    flex-1 h-[42px] rounded-lg text-[14px] font-medium
                    text-gray-700 bg-gray-100 hover:bg-gray-200
                    transition-colors disabled:opacity-50
                  "
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isPending}
                  className={cn(
                    'flex-1 h-[42px] rounded-lg text-[14px] font-medium text-white',
                    'transition-colors disabled:opacity-50',
                    'flex items-center justify-center gap-2',
                    config.buttonColor
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    config.buttonText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusIndicator({ status }: { status: NodeStatus | 'unknown' }): JSX.Element {
  const isActive =
    status === 'running' || status === 'syncing' || status === 'starting' || status === 'stopping';

  const getColor = (): string => {
    switch (status) {
      case 'running':
        return '#10b981';
      case 'syncing':
        return '#f59e0b';
      case 'starting':
        return '#3b82f6';
      case 'stopping':
        return '#f97316';
      case 'error':
        return '#ef4444';
      case 'stopped':
        return '#9ca3af';
      default:
        return '#d1d5db';
    }
  };

  const color = getColor();

  if (isActive) {
    return (
      <div className="relative w-4 h-4">
        {/* Scanning ring */}
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ backgroundColor: color, opacity: 0.3 }}
        />
        {/* Inner solid dot */}
        <div className="absolute inset-1 rounded-full" style={{ backgroundColor: color }} />
      </div>
    );
  }

  return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />;
}

function StatItem({
  icon,
  label,
  value,
  mono = false,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  iconBg?: string;
  iconColor?: string;
}): JSX.Element {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBg || '#F1F5F9', color: iconColor || '#64748b' }}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className={cn('text-[14px] font-medium text-gray-900 pl-8', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  );
}

function EndpointRow({
  protocol,
  url,
  color,
}: {
  protocol: string;
  url: string;
  color: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 sm:gap-3 group">
      <span
        className="w-10 sm:w-12 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-center py-1 rounded shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {protocol}
      </span>
      <code className="flex-1 text-[11px] sm:text-[13px] font-mono text-gray-700 break-all">{url}</code>
      <CopyButton value={url} />
    </div>
  );
}

function ConfigRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[12px] text-gray-400 flex-shrink-0">{label}</span>
      {typeof value === 'string' ? (
        <span className={cn('text-[12px] text-gray-700 text-right break-all', mono && 'font-mono')}>
          {value}
        </span>
      ) : (
        <div className="flex justify-end">{value}</div>
      )}
    </div>
  );
}

function CopyButton({ value }: { value: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (): Promise<void> => {
    try {
      // Try modern clipboard API first (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for HTTP contexts
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // If all else fails, show the value in a prompt
      window.prompt('Copy this URL:', value);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-all"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function AnimatedNumber({ value }: { value: number }): JSX.Element {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      const start = prevValue.current;
      const end = value;
      const duration = 400;
      const startTime = performance.now();

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);

        setDisplayValue(current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
      prevValue.current = value;
    }
  }, [value]);

  return (
    <p className="text-[14px] font-mono font-medium text-gray-900">
      {displayValue.toLocaleString()}
    </p>
  );
}
