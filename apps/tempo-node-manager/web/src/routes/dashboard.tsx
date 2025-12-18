import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { updateApi } from '@/lib/api';
import { cn } from '@/lib/utils';
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
import { useState, useEffect, type JSX } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MobileHeader } from '@/components/MobileHeader';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: (): void => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardLayout,
});

// Persist collapsed state in localStorage
const SIDEBAR_COLLAPSED_KEY = 'tempo-node-manager-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return stored === 'true';
}

function DashboardLayout(): JSX.Element {
  const queryClient = useQueryClient();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

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
    refetchOnMount: 'always', // Always check on page load
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 0, // Always fetch fresh data
  });

  // Install update mutation
  const installMutation = useMutation({
    mutationFn: updateApi.installUpdate,
    onSuccess: data => {
      if (data.success) {
        toast.success(data.message);
        setShowUpdateDialog(false);
        queryClient.invalidateQueries({ queryKey: ['update-check'] });
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error('Failed to install update'),
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

  const handleCheckUpdate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['update-check'] });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        currentVersion={currentVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion ?? undefined}
        onCheckUpdate={handleCheckUpdate}
        onShowUpdateDialog={() => setShowUpdateDialog(true)}
      />

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-[margin] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          collapsed ? 'md:ml-[68px]' : 'md:ml-56'
        )}
      >
        {/* Mobile Header */}
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <div className="p-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
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
