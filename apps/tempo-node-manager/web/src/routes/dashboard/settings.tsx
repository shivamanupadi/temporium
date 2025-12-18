import { createFileRoute } from '@tanstack/react-router';
import { useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, updateApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Lock,
  Info,
  Server,
  Globe,
  Database,
  Zap,
  Shield,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function SettingsPage(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch version
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: updateApi.getVersion,
    staleTime: Infinity,
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    },
  });

  const handleChangePassword = (e: React.FormEvent): void => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    changePasswordMutation.mutate();
  };

  const copyToClipboard = (text: string, field: string): void => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-1">Manage your node manager configuration</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Security Section */}
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Security</h2>
                  <p className="text-[11px] text-slate-500">Update your admin password</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="currentPassword"
                    className="text-[13px] font-medium text-slate-700"
                  >
                    Current Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      disabled={changePasswordMutation.isPending}
                      className="h-10 pl-10 bg-white border-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-violet-100 focus:border-violet-300"
                      placeholder="Enter current password"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-[13px] font-medium text-slate-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      disabled={changePasswordMutation.isPending}
                      className="h-10 pl-10 bg-white border-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-violet-100 focus:border-violet-300"
                      placeholder="Min 8 characters"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-[13px] font-medium text-slate-700"
                  >
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      disabled={changePasswordMutation.isPending}
                      className="h-10 pl-10 bg-white border-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-violet-100 focus:border-violet-300"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {changePasswordMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Update Password
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-6">
          {/* About Card */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Info className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">System Information</h2>
                  <p className="text-[11px] text-slate-500">Node manager details</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <InfoRow
                icon={<Zap className="w-4 h-4 text-amber-500" />}
                label="Version"
                value={versionData?.version || '0.0.0'}
                mono
                color="amber"
              />
              <InfoRow
                icon={<Server className="w-4 h-4 text-violet-500" />}
                label="Docker Image"
                value="ghcr.io/tempoxyz/tempo"
                mono
                color="violet"
                copyable
                onCopy={() => copyToClipboard('ghcr.io/tempoxyz/tempo', 'image')}
                copied={copiedField === 'image'}
              />
              <InfoRow
                icon={<Globe className="w-4 h-4 text-blue-500" />}
                label="Agent Port"
                value="3003"
                mono
                color="blue"
              />
              <InfoRow
                icon={<Database className="w-4 h-4 text-emerald-500" />}
                label="RPC Port"
                value="8545"
                mono
                color="emerald"
              />
            </div>
          </div>

          {/* Links Card */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ExternalLink className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Resources</h2>
                  <p className="text-[11px] text-slate-500">Documentation and support</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <LinkRow
                href="https://docs.tempo.xyz"
                label="Tempo Documentation"
                description="Official node documentation"
              />
              <LinkRow
                href="https://github.com/tempoxyz/tempo"
                label="GitHub Repository"
                description="Source code and issues"
              />
              <LinkRow
                href="https://tempo.xyz"
                label="Tempo Website"
                description="Learn more about Tempo"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
  color = 'slate',
  copyable = false,
  onCopy,
  copied = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  color?: 'amber' | 'violet' | 'blue' | 'emerald' | 'slate';
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}): JSX.Element {
  const bgColors = {
    amber: 'bg-amber-50 border-amber-100',
    violet: 'bg-violet-50 border-violet-100',
    blue: 'bg-blue-50 border-blue-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    slate: 'bg-slate-50 border-slate-200',
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${bgColors[color]}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-[13px] text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[13px] font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function LinkRow({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
    >
      <div>
        <p className="text-[13px] font-medium text-slate-800 group-hover:text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
    </a>
  );
}
