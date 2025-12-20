import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, type JSX } from 'react';
import { publicApi } from '@/lib/api';
import {
  Zap,
  Activity,
  Box,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

export const Route = createFileRoute('/status')({
  component: PublicStatusPage,
});

function PublicStatusPage(): JSX.Element {
  const {
    data: status,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-status'],
    queryFn: publicApi.getStatus,
    refetchInterval: 5000,
  });

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getStatusConfig = (
    nodeStatus?: string
  ): {
    icon: typeof CheckCircle2;
    label: string;
    color: string;
    bg: string;
    dot: string;
  } => {
    switch (nodeStatus) {
      case 'running':
        return {
          icon: CheckCircle2,
          label: 'Online',
          color: 'text-[#16a34a]',
          bg: 'bg-[#dcfce7]',
          dot: 'bg-[#16a34a]',
        };
      case 'syncing':
        return {
          icon: Activity,
          label: 'Syncing',
          color: 'text-[#7c5cff]',
          bg: 'bg-[#f0edff]',
          dot: 'bg-[#7c5cff]',
        };
      case 'stopped':
        return {
          icon: XCircle,
          label: 'Offline',
          color: 'text-[#64748b]',
          bg: 'bg-[#f1f5f9]',
          dot: 'bg-[#94a3b8]',
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          color: 'text-[#dc2626]',
          bg: 'bg-[#fef2f2]',
          dot: 'bg-[#dc2626]',
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          color: 'text-[#64748b]',
          bg: 'bg-[#f1f5f9]',
          dot: 'bg-[#94a3b8]',
        };
    }
  };

  const statusConfig = getStatusConfig(status?.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-[#eef0f3] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-slate-900" strokeWidth={2} />
            <span className="text-[15px] font-semibold text-slate-900">
              Temporium<span className="text-slate-400 font-normal"> | Node Manager</span>
            </span>
          </div>
          <Link
            to="/login"
            className="text-[13px] text-[#64748b] hover:text-[#0f172a] flex items-center gap-1.5 transition-colors"
          >
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#7c5cff]" />
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#fef2f2] flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-[#dc2626]" />
            </div>
            <h2 className="text-[22px] font-semibold text-[#0f172a] tracking-[-0.02em] mb-2">
              Unable to connect
            </h2>
            <p className="text-[15px] text-[#64748b]">
              Could not fetch node status. Please try again.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Status Hero */}
            <div className="text-center">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bg} mb-6`}
              >
                <span className={`w-2 h-2 rounded-full ${statusConfig.dot} animate-pulse`} />
                <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                <span className={`text-[13px] font-semibold ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>

              <h1 className="text-[42px] font-semibold text-[#0f172a] leading-[1.1] tracking-[-0.03em] mb-3">
                {status?.isSynced ? 'Fully Synced' : 'Synchronizing'}
              </h1>
              <p className="text-[17px] text-[#64748b] leading-relaxed">
                {status?.isSynced
                  ? 'Your node is fully synchronized with the network'
                  : `Catching up with the network (${status?.syncProgress?.toFixed(1)}%)`}
              </p>
            </div>

            {/* Sync Progress */}
            {!status?.isSynced && (status?.syncProgress ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-[#eef0f3] p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[15px] font-medium text-[#0f172a]">Sync Progress</span>
                  <span className="text-[15px] font-semibold text-[#7c5cff]">
                    {status?.syncProgress?.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7c5cff] rounded-full transition-all duration-500"
                    style={{ width: `${status?.syncProgress ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-4 text-[13px] text-[#94a3b8]">
                  <span>Block {formatNumber(status?.currentBlock ?? 0)}</span>
                  <span>Target {formatNumber(status?.highestBlock ?? 0)}</span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AnimatedBlockCard
                currentBlock={status?.currentBlock ?? 0}
                formatNumber={formatNumber}
              />
              <StatCard
                icon={Users}
                label="Connected Peers"
                value={status?.peerCount?.toString() ?? '0'}
                iconColor="text-[#16a34a]"
                iconBg="bg-[#dcfce7]"
              />
              <StatCard
                icon={Clock}
                label="Uptime"
                value={formatUptime(status?.uptime)}
                iconColor="text-[#0284c7]"
                iconBg="bg-[#e0f2fe]"
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 border-t border-[#eef0f3] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center">
          <a
            href="https://temporium.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-[#94a3b8] hover:text-[#64748b] transition-colors"
          >
            temporium.xyz
          </a>
        </div>
      </footer>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  iconColor: string;
  iconBg: string;
}

function StatCard({ icon: Icon, label, value, iconColor, iconBg }: StatCardProps): JSX.Element {
  return (
    <div className="bg-white rounded-2xl border border-[#eef0f3] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className="text-[13px] text-[#94a3b8]">{label}</span>
      </div>
      <p className="text-[28px] font-semibold text-[#0f172a] tracking-[-0.02em]">{value}</p>
    </div>
  );
}

interface AnimatedBlockCardProps {
  currentBlock: number;
  formatNumber: (num: number) => string;
}

function AnimatedBlockCard({ currentBlock, formatNumber }: AnimatedBlockCardProps): JSX.Element {
  const [displayBlock, setDisplayBlock] = useState(currentBlock);
  const prevBlockRef = useRef(currentBlock);

  useEffect(() => {
    if (currentBlock !== prevBlockRef.current) {
      const startValue = prevBlockRef.current;
      const endValue = currentBlock;
      const duration = 400;
      const startTime = performance.now();

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * eased);

        setDisplayBlock(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
      prevBlockRef.current = currentBlock;
    }
  }, [currentBlock]);

  return (
    <div className="bg-white rounded-2xl border border-[#eef0f3] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#f0edff] flex items-center justify-center">
          <Box className="w-5 h-5 text-[#7c5cff]" />
        </div>
        <span className="text-[13px] text-[#94a3b8]">Current Block</span>
      </div>
      <p className="text-[28px] font-semibold tracking-[-0.02em] font-mono tabular-nums text-[#0f172a]">
        {formatNumber(displayBlock)}
      </p>
    </div>
  );
}
