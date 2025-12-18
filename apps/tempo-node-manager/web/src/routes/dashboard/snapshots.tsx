import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { snapshotsApi, nodeApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Globe,
  Server,
} from 'lucide-react';
import type { JSX } from 'react';

export const Route = createFileRoute('/dashboard/snapshots')({
  component: SnapshotsPage,
});

function SnapshotsPage(): JSX.Element {
  const queryClient = useQueryClient();

  // Fetch node status
  const { data: nodeInfo } = useQuery({
    queryKey: ['node-status'],
    queryFn: nodeApi.getStatus,
    refetchInterval: 5000,
  });

  // Fetch download status
  const { data: snapshotStatus } = useQuery({
    queryKey: ['snapshot-status'],
    queryFn: snapshotsApi.getStatus,
    refetchInterval: 2000,
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: snapshotsApi.download,
    onSuccess: data => {
      if (data.success) {
        toast.success('Snapshot downloaded successfully!');
        queryClient.invalidateQueries({ queryKey: ['snapshot-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to download snapshot'),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: snapshotsApi.cancel,
    onSuccess: () => {
      toast.success('Download cancelled');
      queryClient.invalidateQueries({ queryKey: ['snapshot-status'] });
    },
  });

  const isDownloading = snapshotStatus?.isDownloading || downloadMutation.isPending;
  const isNodeRunning = nodeInfo?.status === 'running';
  const progress = snapshotStatus?.progress ?? 0;
  const lastLog = snapshotStatus?.lastLog ?? '';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Snapshots</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Download blockchain snapshots for faster sync
        </p>
      </div>

      {/* Download Progress Card */}
      {isDownloading && (
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden ring-1 ring-emerald-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            <h2 className="text-[13px] font-semibold text-emerald-700">
              Downloading Snapshot ({progress}%)
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Progress</span>
                <span className="font-medium text-emerald-600">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Log Output */}
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Current Status</p>
              <div className="bg-slate-950 text-emerald-400 p-3 rounded-lg font-mono text-[11px] max-h-32 overflow-y-auto">
                {lastLog || 'Starting download...'}
              </div>
            </div>

            <p className="text-[12px] text-gray-500">
              Please wait while the snapshot is being downloaded. This may take 30-60 minutes.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="h-8 text-[12px] border-red-200 text-red-600 hover:bg-red-50"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
              )}
              Cancel Download
            </Button>
          </div>
        </div>
      )}

      {/* Download Snapshot Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <h2 className="text-[13px] font-semibold text-gray-900">Tempo Snapshot</h2>
        </div>
        <div className="p-4 space-y-5">
          {/* Snapshot Info */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500">
                <Globe className="w-4 h-4" />
                <span className="text-[13px]">Source</span>
              </div>
              <a
                href="https://snapshots.tempoxyz.dev/42429"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-mono text-violet-600 hover:underline flex items-center gap-1"
              >
                snapshots.tempoxyz.dev
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500">
                <Server className="w-4 h-4" />
                <span className="text-[13px]">Network</span>
              </div>
              <span className="text-[13px] font-medium text-gray-900">Testnet (andantino-1)</span>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Requirements
            </p>
            <div className="space-y-2">
              <RequirementItem
                met={!isNodeRunning}
                label="Node must be stopped"
                description={isNodeRunning ? 'Stop the node first' : 'Node is stopped'}
              />
              <RequirementItem
                met={!isDownloading}
                label="No download in progress"
                description={isDownloading ? 'Download is running' : 'Ready to download'}
              />
            </div>
          </div>

          {/* Download Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => downloadMutation.mutate()}
              disabled={isNodeRunning || isDownloading}
              size="sm"
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px]"
            >
              {downloadMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download Latest Snapshot
                </>
              )}
            </Button>
            {isNodeRunning && (
              <p className="text-[12px] text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Stop the node to download a snapshot
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-[12px] text-blue-700">
              <strong>Tip:</strong> Downloading a snapshot speeds up initial sync from hours to
              ~30-60 minutes. After download completes, start the node and it will continue syncing
              from the snapshot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementItem({
  met,
  label,
  description,
}: {
  met: boolean;
  label: string;
  description: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        met ? 'bg-emerald-50' : 'bg-amber-50'
      )}
    >
      {met ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      )}
      <div>
        <p className={cn('text-[13px] font-medium', met ? 'text-emerald-700' : 'text-amber-700')}>
          {label}
        </p>
        <p className="text-[11px] text-gray-500">{description}</p>
      </div>
    </div>
  );
}
