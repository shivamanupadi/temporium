import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { updateApi } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowUpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, type JSX } from 'react';
import { Header } from '@/components/Header';

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
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
              Update Available
            </DialogTitle>
            <DialogDescription>A new version of Tempo Node Manager is available.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Current</p>
                <p className="font-mono font-medium text-slate-900">{currentVersion}</p>
              </div>
              <div className="text-xl text-slate-300">→</div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Latest</p>
                <p className="font-mono font-medium text-emerald-600">{latestVersion}</p>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              The update will be downloaded and installed. The service will need to be restarted
              after the update.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              Later
            </Button>
            <Button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {installMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Install Update
                </>
              )}
            </Button>
          </DialogFooter>

          {installMutation.isSuccess && installMutation.data.success && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-700 mb-2">
                Update installed successfully. Restart the service to apply changes.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restartMutation.mutate()}
                disabled={restartMutation.isPending}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {restartMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  'Restart Now'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
