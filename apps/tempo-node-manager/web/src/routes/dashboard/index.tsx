import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { nodeApi, snapshotsApi } from '@/lib/api';
import { formatDuration, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
} from 'lucide-react';
import { useState, type JSX } from 'react';
import type { NodeStatus } from '#types/index';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Node Overview</h1>
          <p className="text-muted-foreground">Manage your Tempo blockchain node</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => startMutation.mutate()}
            disabled={isActionPending || isRunning}
            variant={isStopped ? 'default' : 'outline'}
          >
            {startMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Start
          </Button>
          <Button
            onClick={() => stopMutation.mutate()}
            disabled={isActionPending || !isRunning}
            variant="outline"
          >
            {stopMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            Stop
          </Button>
          <Button
            onClick={() => restartMutation.mutate()}
            disabled={isActionPending || !isRunning}
            variant="outline"
          >
            {restartMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Restart
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Node Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nodeLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Status */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={status} />
                  <span className="font-medium capitalize">{status}</span>
                </div>
              </div>

              {/* Version */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">{nodeInfo?.version ?? '-'}</p>
              </div>

              {/* Uptime */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="font-medium">
                  {nodeInfo?.uptime ? formatDuration(nodeInfo.uptime) : '-'}
                </p>
              </div>

              {/* Container ID */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Container</p>
                <p className="font-mono text-sm">{nodeInfo?.containerId?.slice(0, 12) ?? '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Snapshot Download Card - Show when downloading, node is stopped, or syncing slowly */}
      {(isDownloading ||
        isStopped ||
        (nodeInfo?.syncStatus && nodeInfo.syncStatus.syncProgress < 50)) && (
        <Card
          className={cn(
            'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20',
            isDownloading &&
              'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20'
          )}
        >
          <CardHeader>
            <CardTitle
              className={cn(
                'flex items-center gap-2 text-blue-700 dark:text-blue-400',
                isDownloading && 'text-green-700 dark:text-green-400'
              )}
            >
              {isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isDownloading
                ? `Downloading Snapshot${snapshotStatus?.progress ? ` (${snapshotStatus.progress}%)` : '...'}`
                : 'Speed Up Sync with Snapshot'}
            </CardTitle>
            <CardDescription>
              {isDownloading
                ? 'Please wait while the snapshot is being downloaded. This may take 30-60 minutes.'
                : 'Download a pre-synced snapshot to get your node running in ~30-60 minutes instead of hours.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isDownloading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {snapshotStatus?.progress ?? 0}%
                    </span>
                  </div>
                  <Progress value={snapshotStatus?.progress ?? 0} className="h-2" />
                  {snapshotStatus?.lastLog && (
                    <p className="text-xs text-muted-foreground font-mono truncate bg-muted/50 p-2 rounded">
                      {snapshotStatus.lastLog}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  {isDownloading ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Download in progress... Do not close this page.
                    </div>
                  ) : isRunning ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      Stop the node first to download a snapshot
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This will download the latest blockchain snapshot from Tempo&apos;s servers.
                    </p>
                  )}
                </div>
                {!isDownloading && (
                  <Button
                    onClick={() => downloadSnapshotMutation.mutate()}
                    disabled={isRunning || isDownloading}
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Snapshot
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Details */}
      {isRunning && nodeInfo?.config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <ConnectionDetail
                label="HTTP RPC Endpoint"
                value={`http://localhost:${nodeInfo.config.httpPort}`}
              />
              <ConnectionDetail label="P2P Port" value={nodeInfo.config.p2pPort.toString()} />
              <ConnectionDetail label="Data Directory" value={nodeInfo.config.dataDir} />
              <ConnectionDetail label="Enabled APIs" value={nodeInfo.config.httpApis.join(', ')} />
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Quick Connect</p>
              <code className="text-sm font-mono break-all">
                cast block-number --rpc-url http://localhost:{nodeInfo.config.httpPort}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      {nodeInfo?.syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Sync Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{nodeInfo.syncStatus.syncProgress}%</span>
              </div>
              <Progress value={nodeInfo.syncStatus.syncProgress} />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Block</p>
                  <p className="font-mono">{nodeInfo.syncStatus.currentBlock.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Highest Block</p>
                  <p className="font-mono">{nodeInfo.syncStatus.highestBlock.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> Peers
                  </p>
                  <p className="font-mono">{nodeInfo.syncStatus.peerCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: NodeStatus | 'unknown' }): JSX.Element {
  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full',
        status === 'running' && 'bg-green-500 animate-pulse',
        status === 'stopped' && 'bg-gray-400',
        status === 'syncing' && 'bg-yellow-500 animate-pulse',
        status === 'starting' && 'bg-blue-500 animate-pulse',
        status === 'stopping' && 'bg-orange-500 animate-pulse',
        status === 'error' && 'bg-red-500',
        status === 'not_installed' && 'bg-gray-300',
        status === 'unknown' && 'bg-gray-300'
      )}
    />
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
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm truncate">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 ml-2"
        onClick={copyToClipboard}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
