import { createFileRoute } from '@tanstack/react-router';
import { useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, updateApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Info, Server, Globe, Database, Zap } from 'lucide-react';

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function SettingsPage(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Manage your node manager settings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Change Password Card */}
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            <h2 className="text-[13px] font-semibold text-gray-900">Change Password</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-[13px] font-medium text-gray-700">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  disabled={changePasswordMutation.isPending}
                  className="h-10 bg-gray-50 border-gray-200 text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-[13px] font-medium text-gray-700">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  disabled={changePasswordMutation.isPending}
                  className="h-10 bg-gray-50 border-gray-200 text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-gray-700">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={changePasswordMutation.isPending}
                  className="h-10 bg-gray-50 border-gray-200 text-[13px]"
                />
              </div>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                size="sm"
                className="h-9 bg-gray-900 hover:bg-gray-800 text-white text-[13px]"
              >
                {changePasswordMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Update Password
              </Button>
            </form>
          </div>
        </div>

        {/* About Card */}
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            <h2 className="text-[13px] font-semibold text-gray-900">About</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <InfoRow
                icon={<Zap className="w-4 h-4" />}
                label="Version"
                value={versionData?.version || '0.0.0'}
                mono
              />
              <InfoRow
                icon={<Server className="w-4 h-4" />}
                label="Tempo Image"
                value="ghcr.io/tempoxyz/tempo"
                mono
              />
              <InfoRow icon={<Globe className="w-4 h-4" />} label="Agent Port" value="3003" mono />
              <InfoRow icon={<Database className="w-4 h-4" />} label="RPC Port" value="8545" mono />
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-[13px]">{label}</span>
      </div>
      <span className={`text-[13px] font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
