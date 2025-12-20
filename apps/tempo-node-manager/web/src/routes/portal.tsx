import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { updateApi } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowUpCircle, Loader2, X, RotateCcw } from 'lucide-react';
import { useState, type JSX } from 'react';
import { Header } from '@/components/Header';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/portal')({
  beforeLoad: (): void => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: PortalLayout,
});

function PortalLayout(): JSX.Element {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Fetch current version
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: updateApi.getVersion,
    staleTime: Infinity,
  });

  // Check for updates on page load and periodically
  const { data: updateInfo } = useQuery({
    queryKey: ['update-check'],
    queryFn: updateApi.checkForUpdates,
    refetchOnMount: 'always',
    refetchInterval: 5 * 60 * 1000,
    staleTime: 0,
  });

  // Install update mutation
  const installMutation = useMutation({
    mutationFn: updateApi.installUpdate,
    onSuccess: data => {
      if (data.success) {
        toast.success('Update installed! Reloading page...');
        setShowUpdateDialog(false);
        setTimeout(() => window.location.reload(), 3000);
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      toast.success('Update installed! Reloading page...');
      setShowUpdateDialog(false);
      setTimeout(() => window.location.reload(), 3000);
    },
  });

  // Restart service mutation
  const restartMutation = useMutation({
    mutationFn: updateApi.restart,
    onSuccess: data => {
      if (data.success) {
        toast.success('Restarting service... Page will reload shortly.');
        setTimeout(() => window.location.reload(), 5000);
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to restart service'),
  });

  const currentVersion = versionData?.version || '0.0.0';
  const updateAvailable = updateInfo?.updateAvailable || false;
  const latestVersion = updateInfo?.latest;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <Header
        currentVersion={currentVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion ?? undefined}
        onShowUpdateDialog={() => setShowUpdateDialog(true)}
      />

      {/* Main Content */}
      <main className="pt-8 pb-6">
        <div className="mx-auto max-w-5xl px-6">
          <Outlet />
        </div>
      </main>

      {/* Update Dialog */}
      <AnimatePresence>
        {showUpdateDialog && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => !installMutation.isPending && setShowUpdateDialog(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] z-50 px-4"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">Update Available</h2>
                    </div>
                    <button
                      onClick={() => setShowUpdateDialog(false)}
                      disabled={installMutation.isPending}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[13px] text-gray-500">
                    A new version of Tempo Node Manager is available.
                  </p>
                </div>

                {/* Version comparison */}
                <div className="px-6 pb-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-center">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">
                        Current
                      </p>
                      <p className="font-mono text-[15px] font-semibold text-gray-900">
                        v{currentVersion}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <div className="w-8 h-px bg-gray-200" />
                      <span className="text-lg">→</span>
                      <div className="w-8 h-px bg-gray-200" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">
                        Latest
                      </p>
                      <p className="font-mono text-[15px] font-semibold text-emerald-600">
                        v{latestVersion}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="px-6 pb-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[13px] text-slate-600">
                      The update will be downloaded and installed. The service will restart
                      automatically after installation.
                    </p>
                  </div>
                </div>

                {/* Restart prompt after successful install */}
                {installMutation.isSuccess && installMutation.data.success && (
                  <div className="px-6 pb-4">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <RotateCcw className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-amber-800 mb-1">
                            Update installed successfully
                          </p>
                          <p className="text-[12px] text-amber-700 mb-3">
                            Restart the service to apply changes.
                          </p>
                          <button
                            onClick={() => restartMutation.mutate()}
                            disabled={restartMutation.isPending}
                            className={cn(
                              'h-8 px-3 rounded-lg text-[13px] font-medium',
                              'bg-amber-600 hover:bg-amber-700 text-white',
                              'transition-colors disabled:opacity-50',
                              'flex items-center gap-2'
                            )}
                          >
                            {restartMutation.isPending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Restarting...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restart Now
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={() => setShowUpdateDialog(false)}
                    disabled={installMutation.isPending}
                    className="
                      flex-1 h-[42px] rounded-lg text-[14px] font-medium
                      text-gray-700 bg-gray-100 hover:bg-gray-200
                      transition-colors disabled:opacity-50
                    "
                  >
                    Later
                  </button>
                  <button
                    onClick={() => installMutation.mutate()}
                    disabled={installMutation.isPending || installMutation.isSuccess}
                    className={cn(
                      'flex-1 h-[42px] rounded-lg text-[14px] font-medium text-white',
                      'bg-emerald-600 hover:bg-emerald-700',
                      'transition-colors disabled:opacity-50',
                      'flex items-center justify-center gap-2'
                    )}
                  >
                    {installMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Installing...
                      </>
                    ) : installMutation.isSuccess ? (
                      'Installed'
                    ) : (
                      <>
                        <ArrowUpCircle className="w-4 h-4" />
                        Install Update
                      </>
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
