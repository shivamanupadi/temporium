import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { validatePassword, PASSWORD_REQUIREMENTS } from '@/lib/validation';
import { Loader2, Shield, X } from 'lucide-react';

export const Route = createFileRoute('/portal/settings')({
  component: SettingsPage,
});

function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setShowConfirmDialog(false);
      toast.success('Password changed successfully. Logging out...');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Auto logout after successful password change
      setTimeout(() => {
        logout();
        navigate({ to: '/login' });
      }, 1500);
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      toast.error(`Password requirement: ${validationError}`);
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = (): void => {
    changePasswordMutation.mutate();
  };

  const handleClose = (): void => {
    if (!changePasswordMutation.isPending) {
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-1">Manage your node manager configuration</p>
      </div>

      <div className="max-w-md">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-[13px] font-medium text-[#374151] mb-2"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  className="
                    w-full h-[46px] px-4 rounded-lg text-[15px] text-[#0f172a]
                    bg-white border border-[#e5e7eb]
                    placeholder:text-[#a1a1aa]
                    hover:border-[#d1d5db]
                    focus:border-[#b0b5bd]
                  "
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-[13px] font-medium text-[#374151] mb-2"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="Enter new password"
                  className="
                    w-full h-[46px] px-4 rounded-lg text-[15px] text-[#0f172a]
                    bg-white border border-[#e5e7eb]
                    placeholder:text-[#a1a1aa]
                    hover:border-[#d1d5db]
                    focus:border-[#b0b5bd]
                  "
                />
                <p className="text-[12px] text-[#94a3b8] mt-2">{PASSWORD_REQUIREMENTS}</p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-[13px] font-medium text-[#374151] mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  className="
                    w-full h-[46px] px-4 rounded-lg text-[15px] text-[#0f172a]
                    bg-white border border-[#e5e7eb]
                    placeholder:text-[#a1a1aa]
                    hover:border-[#d1d5db]
                    focus:border-[#b0b5bd]
                  "
                />
              </div>
              <button
                type="submit"
                className="
                  w-full h-[46px] mt-2 rounded-lg text-[15px] font-medium text-white
                  bg-[#7c5cff] hover:bg-[#6b4fee] active:bg-[#5f43e5]
                  transition-all duration-200
                  shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(124,92,255,0.25)]
                  hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(124,92,255,0.35)]
                "
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmDialog && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[360px] z-50 px-4"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Confirm Change</h2>
                    <button
                      onClick={handleClose}
                      disabled={changePasswordMutation.isPending}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[13px] text-gray-500">
                    Are you sure you want to update your password?
                  </p>
                </div>

                {/* Warning */}
                <div className="px-6 pb-4">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-[13px] text-amber-700">
                      You will be logged out and need to sign in with your new password.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={changePasswordMutation.isPending}
                    className="
                      flex-1 h-[42px] rounded-lg text-[14px] font-medium
                      text-gray-700 bg-gray-100 hover:bg-gray-200
                      transition-colors disabled:opacity-50
                    "
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmChange}
                    disabled={changePasswordMutation.isPending}
                    className="
                      flex-1 h-[42px] rounded-lg text-[14px] font-medium text-white
                      bg-[#7c5cff] hover:bg-[#6b4fee]
                      transition-colors disabled:opacity-50
                      flex items-center justify-center gap-2
                    "
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
