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
import { Progress } from '@/components/ui/progress';

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
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          dot: 'bg-emerald-500',
        };
      case 'syncing':
        return {
          icon: Activity,
          label: 'Syncing',
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          dot: 'bg-blue-500',
        };
      case 'stopped':
        return {
          icon: XCircle,
          label: 'Offline',
          color: 'text-gray-500',
          bg: 'bg-gray-100',
          dot: 'bg-gray-400',
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          color: 'text-red-600',
          bg: 'bg-red-50',
          dot: 'bg-red-500',
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          color: 'text-gray-500',
          bg: 'bg-gray-100',
          dot: 'bg-gray-400',
        };
    }
  };

  const statusConfig = getStatusConfig(status?.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
            <span className="text-lg font-bold text-slate-900 tracking-tight">Temporium</span>
            <span className="text-slate-300 font-light">|</span>
            <span className="text-lg text-slate-600">Node Manager</span>
          </div>
          <Link
            to="/login"
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to connect</h2>
            <p className="text-sm text-slate-500">Could not fetch node status. Please try again.</p>
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
                <span className={`text-sm font-semibold ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>

              <h2 className="text-4xl font-bold text-slate-900 mb-2">
                {status?.isSynced ? 'Fully Synced' : 'Synchronizing'}
              </h2>
              <p className="text-slate-500">
                {status?.isSynced
                  ? 'Your node is fully synchronized with the network'
                  : `Catching up with the network (${status?.syncProgress?.toFixed(1)}%)`}
              </p>
            </div>

            {/* Sync Progress */}
            {!status?.isSynced && (status?.syncProgress ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">Sync Progress</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {status?.syncProgress?.toFixed(2)}%
                  </span>
                </div>
                <Progress value={status?.syncProgress ?? 0} className="h-2" />
                <div className="flex justify-between mt-3 text-xs text-slate-500">
                  <span>Block {formatNumber(status?.currentBlock ?? 0)}</span>
                  <span>Target {formatNumber(status?.highestBlock ?? 0)}</span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <AnimatedBlockCard
                currentBlock={status?.currentBlock ?? 0}
                formatNumber={formatNumber}
              />
              <StatCard
                icon={Users}
                label="Connected Peers"
                value={status?.peerCount?.toString() ?? '0'}
                iconColor="text-emerald-600"
                iconBg="bg-emerald-50"
              />
              <StatCard
                icon={Clock}
                label="Uptime"
                value={formatUptime(status?.uptime)}
                iconColor="text-amber-600"
                iconBg="bg-amber-50"
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <a
            href="https://temporium.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
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
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

interface AnimatedBlockCardProps {
  currentBlock: number;
  formatNumber: (num: number) => string;
}

function AnimatedBlockCard({ currentBlock, formatNumber }: AnimatedBlockCardProps): JSX.Element {
  const [displayBlock, setDisplayBlock] = useState(currentBlock);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevBlockRef = useRef(currentBlock);

  useEffect(() => {
    if (currentBlock !== prevBlockRef.current && currentBlock > prevBlockRef.current) {
      const startValue = prevBlockRef.current;
      const endValue = currentBlock;
      const duration = 500;
      const startTime = performance.now();

      setIsAnimating(true);

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);

        setDisplayBlock(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
      prevBlockRef.current = currentBlock;
    } else if (currentBlock !== displayBlock && !isAnimating) {
      setDisplayBlock(currentBlock);
      prevBlockRef.current = currentBlock;
    }
  }, [currentBlock, displayBlock, isAnimating]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
        <Box className="w-5 h-5 text-blue-600" />
      </div>
      <p
        className={`text-2xl font-bold text-slate-900 mb-0.5 font-mono tabular-nums transition-colors duration-200 ${
          isAnimating ? 'text-blue-600' : ''
        }`}
      >
        {formatNumber(displayBlock)}
      </p>
      <p className="text-xs text-slate-500">Current Block</p>
    </div>
  );
}
