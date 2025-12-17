import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { metricsApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Cpu, Box, HardDrive, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const Route = createFileRoute('/dashboard/metrics')({
  component: MetricsPage,
});

function MetricsPage() {
  // Current metrics
  const { data: current, isLoading: currentLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: metricsApi.getCurrent,
    refetchInterval: 5000,
  });

  // Historical metrics
  const { data: history } = useQuery({
    queryKey: ['metrics-history'],
    queryFn: () => metricsApi.getHistory(100),
    refetchInterval: 30000,
  });

  const chartData =
    history?.map((point) => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString(),
    })) ?? [];

  if (currentLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Metrics</h1>
        <p className="text-muted-foreground">
          Resource usage and performance monitoring
        </p>
      </div>

      {/* Current Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU"
          icon={Cpu}
          value={`${current?.cpu.usagePercent.toFixed(1) ?? '-'}%`}
          details={[
            { label: 'Cores', value: current?.cpu.cores?.toString() ?? '-' },
            { label: 'Model', value: current?.cpu.model ?? '-' },
          ]}
        />
        <MetricCard
          title="Memory"
          icon={Box}
          value={`${current?.memory.usagePercent.toFixed(1) ?? '-'}%`}
          details={[
            { label: 'Used', value: formatBytes(current?.memory.used ?? 0) },
            { label: 'Total', value: formatBytes(current?.memory.total ?? 0) },
          ]}
        />
        <MetricCard
          title="Disk"
          icon={HardDrive}
          value={`${current?.disk.usagePercent.toFixed(1) ?? '-'}%`}
          details={[
            { label: 'Used', value: formatBytes(current?.disk.used ?? 0) },
            { label: 'Total', value: formatBytes(current?.disk.total ?? 0) },
          ]}
        />
        <MetricCard
          title="Network"
          icon={Activity}
          value={formatBytes(current?.network.rxBytesPerSec ?? 0) + '/s'}
          details={[
            {
              label: 'Download',
              value: formatBytes(current?.network.rxBytesPerSec ?? 0) + '/s',
            },
            {
              label: 'Upload',
              value: formatBytes(current?.network.txBytesPerSec ?? 0) + '/s',
            },
          ]}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpuUsage"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="memoryUsage"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  icon: Icon,
  value,
  details,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  details: { label: string; value: string }[];
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <div className="space-y-0.5 pt-2">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>{detail.label}</span>
                  <span className="font-mono">{detail.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
