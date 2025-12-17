import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { snapshotsApi, nodeApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    onSuccess: (data) => {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Snapshots</h1>
        <p className="text-muted-foreground">
          Download blockchain snapshots for faster sync
        </p>
      </div>

      {/* Download Progress Card */}
      {isDownloading && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Downloading Snapshot ({progress}%)
            </CardTitle>
            <CardDescription>
              Please wait while the snapshot is being downloaded. This may take 30-60 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-green-700 dark:text-green-400">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Log Output */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Status:</p>
              <div className="bg-black/90 text-green-400 p-4 rounded-lg font-mono text-sm max-h-48 overflow-y-auto">
                {lastLog || 'Starting download...'}
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Cancel Download
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Download Snapshot Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Tempo Snapshot
          </CardTitle>
          <CardDescription>
            Download the latest blockchain snapshot from Tempo&apos;s official servers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Snapshot Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Source</p>
              <a
                href="https://snapshots.tempoxyz.dev/42429"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-primary hover:underline flex items-center gap-1"
              >
                snapshots.tempoxyz.dev
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Network</p>
              <p className="text-sm font-medium">Testnet (andantino-1)</p>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Requirements:</p>
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
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {downloadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Latest Snapshot
                </>
              )}
            </Button>
            {isNodeRunning && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Stop the node to download a snapshot
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> Downloading a snapshot speeds up initial sync from hours to ~30-60 minutes.
              After download completes, start the node and it will continue syncing from the snapshot.
            </p>
          </div>
        </CardContent>
      </Card>
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
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg",
      met ? "bg-green-50 dark:bg-green-950/20" : "bg-amber-50 dark:bg-amber-950/20"
    )}>
      {met ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      )}
      <div>
        <p className={cn(
          "text-sm font-medium",
          met ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
        )}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
