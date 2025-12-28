import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, type JSX } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, systemApi, type RequirementCheck } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { validatePassword, PASSWORD_REQUIREMENTS } from '@/lib/validation';
import {
  Loader2,
  ArrowRight,
  Zap,
  MousePointerClick,
  Activity,
  HardDrive,
  AlertTriangle,
  Cpu,
  MemoryStick,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { setToken, isAuthenticated } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/portal/dashboard' });
    }
  }, [isAuthenticated, navigate]);

  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['auth-status'],
    queryFn: authApi.getStatus,
  });

  const isSetup = status?.isSetup ?? false;

  // Check system requirements only during setup (not login)
  const { data: requirements, isLoading: isLoadingRequirements } = useQuery({
    queryKey: ['system-requirements'],
    queryFn: systemApi.checkRequirements,
    enabled: !isSetup, // Only check during setup, not login
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: data => {
      setToken(data.accessToken);
      navigate({ to: '/portal/dashboard' });
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    },
  });

  const setupMutation = useMutation({
    mutationFn: authApi.setup,
    onSuccess: data => {
      setToken(data.accessToken);
      navigate({ to: '/portal/dashboard' });
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Setup failed');
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!isSetup) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      const validationError = validatePassword(password);
      if (validationError) {
        toast.error(`Password requirement: ${validationError}`);
        return;
      }
      setupMutation.mutate(password);
    } else {
      loginMutation.mutate(password);
    }
  };

  const isSubmitting = loginMutation.isPending || setupMutation.isPending;
  const meetsRequirements = isSetup || requirements?.meetsMinimum;

  if (isLoadingStatus || (!isSetup && isLoadingRequirements)) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#7c5cff]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-[#fafafa]">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-[#f5f3ff]">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e9e5ff 1px, transparent 1px),
              linear-gradient(to bottom, #e9e5ff 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Top - Logo */}
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-[#0f172a]" strokeWidth={2.5} />
            <span className="text-[17px] font-semibold text-[#0f172a] tracking-[-0.01em]">
              Temporium
            </span>
          </div>

          {/* Center - Main content */}
          <div>
            <div className="max-w-[420px]">
              <h1 className="text-[52px] xl:text-[60px] font-semibold text-[#0f172a] leading-[1.05] tracking-[-0.035em] mb-6">
                Node
                <br />
                Manager
              </h1>
              <p className="text-[17px] text-[#64748b] leading-[1.6] max-w-[340px]">
                Streamlined deployment and real-time monitoring for your Tempo node.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-nowrap gap-6 mt-12 pt-8 border-t border-[#e2e0f5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#e0f2fe] flex items-center justify-center">
                  <MousePointerClick className="w-5 h-5 text-[#0284c7]" />
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-[#0f172a] tracking-[-0.01em]">
                    One-Click
                  </div>
                  <div className="text-[13px] text-[#94a3b8]">Setup</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[#16a34a]" />
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-[#0f172a] tracking-[-0.01em]">
                    Real-time
                  </div>
                  <div className="text-[13px] text-[#94a3b8]">Sync monitoring</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f0edff] flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-[#7c5cff]" />
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-[#0f172a] tracking-[-0.01em]">
                    Snapshot
                  </div>
                  <div className="text-[13px] text-[#94a3b8]">Fast sync</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom - Footer */}
          <div className="text-[13px] text-[#94a3b8]">Powered by Tempo Network</div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col bg-[#fafafa]">
        {/* Mobile header */}
        <div className="lg:hidden p-6 flex items-center gap-2.5 border-b border-[#f0f0f0] bg-white">
          <Zap className="w-5 h-5 text-[#0f172a]" strokeWidth={2.5} />
          <span className="text-[15px] font-semibold text-[#0f172a]">Temporium</span>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-[360px]">
            {/* Show requirements failure screen during setup if requirements not met */}
            {!isSetup && !meetsRequirements && requirements ? (
              <RequirementsNotMet requirements={requirements} />
            ) : (
              <>
                {/* Header */}
                <div className="mb-8">
                  <h2 className="text-[26px] font-semibold text-[#0f172a] tracking-[-0.02em] mb-2">
                    {isSetup ? 'Welcome back' : 'Get started'}
                  </h2>
                  <p className="text-[15px] text-[#64748b]">
                    {isSetup
                      ? 'Enter your password to continue'
                      : 'Create a password for your dashboard'}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-[13px] font-medium text-[#374151] mb-2"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={isSetup ? 'Enter password' : 'Create password'}
                      required
                      disabled={isSubmitting}
                      className="
                        w-full h-[46px] px-4 rounded-lg text-[15px] text-[#0f172a]
                        bg-white border border-[#e5e7eb]
                        placeholder:text-[#a1a1aa]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        hover:border-[#d1d5db]
                        focus:border-[#b0b5bd]
                      "
                    />
                    {!isSetup && (
                      <p className="text-[12px] text-[#94a3b8] mt-2">{PASSWORD_REQUIREMENTS}</p>
                    )}
                  </div>

                  {!isSetup && (
                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-[13px] font-medium text-[#374151] mb-2"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        required
                        disabled={isSubmitting}
                        className="
                          w-full h-[46px] px-4 rounded-lg text-[15px] text-[#0f172a]
                          bg-white border border-[#e5e7eb]
                          placeholder:text-[#a1a1aa]
                          disabled:opacity-50 disabled:cursor-not-allowed
                          hover:border-[#d1d5db]
                          focus:border-[#b0b5bd]
                        "
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="
                      w-full h-[46px] mt-2 rounded-lg text-[15px] font-medium text-white
                      bg-[#7c5cff] hover:bg-[#6b4fee] active:bg-[#5f43e5]
                      flex items-center justify-center gap-2
                      transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(124,92,255,0.25)]
                      hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(124,92,255,0.35)]
                    "
                  >
                    {isSetup ? 'Sign in' : 'Create account'}
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </form>

                {/* Footer text */}
                <p className="mt-8 text-center text-[13px] text-[#94a3b8]">
                  {isSetup
                    ? 'Forgot password? Reset the database to start fresh.'
                    : 'This password protects your node dashboard.'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Requirements not met component
function RequirementsNotMet({
  requirements,
}: {
  requirements: {
    meetsMinimum: boolean;
    checks: { cpu: RequirementCheck; memory: RequirementCheck; storage: RequirementCheck };
  };
}): JSX.Element {
  const { checks } = requirements;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-[26px] font-semibold text-[#0f172a] tracking-[-0.02em] mb-2">
          System Requirements
        </h2>
        <p className="text-[15px] text-[#64748b]">
          Your system does not meet the minimum requirements to run a Tempo node.
        </p>
      </div>

      {/* Requirements list */}
      <div className="space-y-3 mb-6">
        <RequirementRow icon={<Cpu className="w-4 h-4" />} check={checks.cpu} />
        <RequirementRow icon={<MemoryStick className="w-4 h-4" />} check={checks.memory} />
        <RequirementRow icon={<HardDrive className="w-4 h-4" />} check={checks.storage} />
      </div>

      {/* Info box */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
        <p className="text-[13px] text-slate-600">
          Please upgrade your system to meet the minimum requirements before setting up the node
          manager.
        </p>
        <p className="text-[13px] text-slate-600">After upgrading, re-run the install command:</p>
        <code className="block text-[12px] font-mono text-slate-700 bg-slate-100 px-3 py-2 rounded-lg break-all">
          curl -sSL https://cdn.temporium.xyz/node-manager/releases/install.sh | bash
        </code>
      </div>
    </div>
  );
}

function RequirementRow({
  icon,
  check,
}: {
  icon: React.ReactNode;
  check: RequirementCheck;
}): JSX.Element {
  const meetsMin = check.meetsMinimum;

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-colors',
        meetsMin ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              meetsMin ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
            )}
          >
            {icon}
          </div>
          <div>
            <p className="text-[13px] font-medium text-slate-900">{check.name}</p>
            <p className="text-[12px] text-slate-500">Min: {check.minimumFormatted}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[14px] font-semibold',
              meetsMin ? 'text-emerald-600' : 'text-red-500'
            )}
          >
            {check.currentFormatted}
          </span>
          {meetsMin ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>
    </div>
  );
}
