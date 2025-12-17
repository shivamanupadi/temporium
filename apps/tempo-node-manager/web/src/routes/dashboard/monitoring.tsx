import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { monitoringApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Play,
  Square,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Database,
} from 'lucide-react';

export const Route = createFileRoute('/dashboard/monitoring')({
  component: MonitoringPage,
});

function MonitoringPage() {
  const queryClient = useQueryClient();

  // Fetch monitoring status
  const { data: status, isLoading } = useQuery({
    queryKey: ['monitoring-status'],
    queryFn: monitoringApi.getStatus,
    refetchInterval: 5000,
  });

  // Start monitoring mutation
  const startMutation = useMutation({
    mutationFn: monitoringApi.start,
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Monitoring stack started!');
        queryClient.invalidateQueries({ queryKey: ['monitoring-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to start monitoring'),
  });

  // Stop monitoring mutation
  const stopMutation = useMutation({
    mutationFn: monitoringApi.stop,
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Monitoring stack stopped');
        queryClient.invalidateQueries({ queryKey: ['monitoring-status'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to stop monitoring'),
  });

  const isRunning = status?.prometheusRunning && status?.grafanaRunning;
  const isPartiallyRunning = status?.prometheusRunning || status?.grafanaRunning;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitoring</h1>
        <p className="text-muted-foreground">
          Prometheus + Grafana monitoring stack
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Monitoring Stack Status
          </CardTitle>
          <CardDescription>
            Run Prometheus and Grafana for advanced metrics visualization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking status...
            </div>
          ) : (
            <>
              {/* Service Status */}
              <div className="grid gap-4 md:grid-cols-2">
                <ServiceStatus
                  name="Prometheus"
                  description="Time-series metrics database"
                  running={status?.prometheusRunning ?? false}
                  url={status?.prometheusUrl ?? 'http://localhost:9090'}
                  icon={<Database className="w-5 h-5" />}
                />
                <ServiceStatus
                  name="Grafana"
                  description="Metrics visualization dashboard"
                  running={status?.grafanaRunning ?? false}
                  url={status?.grafanaUrl ?? 'http://localhost:3000'}
                  icon={<BarChart3 className="w-5 h-5" />}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 pt-4 border-t">
                {!isRunning ? (
                  <Button
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {startMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Monitoring Stack
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                  >
                    {stopMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop Monitoring Stack
                      </>
                    )}
                  </Button>
                )}

                {isPartiallyRunning && !isRunning && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Some services are not running
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Prometheus Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Metrics Endpoint
          </CardTitle>
          <CardDescription>
            Prometheus-compatible metrics endpoint for custom monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Prometheus Scrape Target</p>
            <code className="text-sm font-mono text-primary">
              http://localhost:9545/api/metrics/prometheus
            </code>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> You can use this endpoint with your own Prometheus/Grafana setup.
              Add the target URL above to your prometheus.yml configuration.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Available Metrics:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>- <code>tempo_manager_cpu_usage_percent</code></li>
              <li>- <code>tempo_manager_memory_usage_percent</code></li>
              <li>- <code>tempo_manager_memory_total_bytes</code></li>
              <li>- <code>tempo_manager_memory_used_bytes</code></li>
              <li>- <code>tempo_manager_disk_usage_percent</code></li>
              <li>- <code>tempo_manager_disk_total_bytes</code></li>
              <li>- <code>tempo_manager_disk_used_bytes</code></li>
              <li>- <code>tempo_manager_network_rx_bytes_per_sec</code></li>
              <li>- <code>tempo_manager_network_tx_bytes_per_sec</code></li>
              <li>- <code>tempo_manager_system_uptime_seconds</code></li>
              <li>- + Node.js process metrics</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Grafana Info */}
      {isRunning && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              Grafana Ready
            </CardTitle>
            <CardDescription>
              Access the pre-configured Tempo Node Manager dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-white dark:bg-gray-900">
                <p className="text-sm text-muted-foreground mb-1">Default Credentials</p>
                <p className="text-sm font-mono">
                  Username: <strong>admin</strong><br />
                  Password: <strong>admin</strong>
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white dark:bg-gray-900">
                <p className="text-sm text-muted-foreground mb-1">Dashboard</p>
                <p className="text-sm">
                  Pre-configured "Tempo Node Manager" dashboard is automatically loaded
                </p>
              </div>
            </div>

            <Button asChild className="w-full md:w-auto">
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Open Grafana Dashboard
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ServiceStatus({
  name,
  description,
  running,
  url,
  icon,
}: {
  name: string;
  description: string;
  running: boolean;
  url: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`p-4 rounded-lg border ${
      running
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
        : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={running ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
            {icon}
          </span>
          <span className="font-medium">{name}</span>
        </div>
        {running ? (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Running
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-gray-400">
            <XCircle className="w-4 h-4" />
            Stopped
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-2">{description}</p>
      {running && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          {url}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
