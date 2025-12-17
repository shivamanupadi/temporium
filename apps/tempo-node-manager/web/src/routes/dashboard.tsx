import { createFileRoute, redirect, Outlet, Link, useLocation } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { updateApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Server,
  ScrollText,
  Download,
  Settings,
  LogOut,
  ArrowUpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
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

export const Route = createFileRoute('/dashboard')({
  beforeLoad: (): void => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardLayout,
});

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: Server, exact: true },
  { to: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { to: '/dashboard/snapshots', label: 'Snapshots', icon: Download },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function DashboardLayout(): JSX.Element {
  const location = useLocation();
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Fetch current version
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: updateApi.getVersion,
    staleTime: Infinity,
  });

  // Check for updates periodically
  const { data: updateInfo } = useQuery({
    queryKey: ['update-check'],
    queryFn: updateApi.checkForUpdates,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 60 * 1000,
  });

  // Install update mutation
  const installMutation = useMutation({
    mutationFn: updateApi.installUpdate,
    onSuccess: (data) => {
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
    onSuccess: (data) => {
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary">
                <Server className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold">Tempo Node</h1>
                <p className="text-xs text-muted-foreground">Manager</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Version & Update */}
          <div className="p-4 border-t space-y-3">
            {/* Update Available Banner */}
            {updateAvailable && (
              <button
                onClick={() => setShowUpdateDialog(true)}
                className="w-full flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <div className="flex-1 text-left">
                  <p className="text-xs font-medium">Update Available</p>
                  <p className="text-xs opacity-75">v{latestVersion}</p>
                </div>
              </button>
            )}

            {/* Version Display */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Version {currentVersion}</span>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['update-check'] })}
                className="p-1 hover:bg-accent rounded"
                title="Check for updates"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Logout Button */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-green-500" />
              Update Available
            </DialogTitle>
            <DialogDescription>
              A new version of Tempo Node Manager is available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
              <div>
                <p className="text-sm text-muted-foreground">Current Version</p>
                <p className="font-mono font-medium">{currentVersion}</p>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div>
                <p className="text-sm text-muted-foreground">New Version</p>
                <p className="font-mono font-medium text-green-600 dark:text-green-400">
                  {latestVersion}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              The update will be downloaded and installed. The service will need to be restarted after the update.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(false)}
            >
              Later
            </Button>
            <Button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
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
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                Update installed successfully. Restart the service to apply changes.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restartMutation.mutate()}
                disabled={restartMutation.isPending}
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
