import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Trash2,
  ChevronLeft,
  Shield,
  Clock,
  MoreVertical,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getConnectedApps, removeConnectedApp } from '@/lib/connected-apps';
import { formatTimeAgo } from '@/lib/utils';
import type { ConnectedApp } from '@/types';

export const Route = createFileRoute('/manage')({
  component: ManagePage,
});

function ManagePage(): ReactElement {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<ConnectedApp | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokedId, setRevokedId] = useState<string | null>(null);

  // Load connected apps
  useEffect(() => {
    const loadApps = () => {
      const connectedApps = getConnectedApps();
      // Sort by last used (most recent first)
      connectedApps.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      setApps(connectedApps);
    };

    loadApps();

    // Listen for storage changes (in case another tab modifies)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'temporium_connected_apps') {
        loadApps();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleRevoke = () => {
    if (!selectedApp) return;

    removeConnectedApp(selectedApp.id);
    setRevokedId(selectedApp.id);
    setShowRevokeDialog(false);

    // Update local state
    setApps(prev => prev.filter(app => app.id !== selectedApp.id));
    setSelectedApp(null);

    // Clear revoked indicator after animation
    setTimeout(() => setRevokedId(null), 2000);
  };

  const handleOpenRevokeDialog = (app: ConnectedApp) => {
    setSelectedApp(app);
    setShowRevokeDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Connected Apps</h1>
            <p className="text-xs text-muted-foreground">
              {apps.length} app{apps.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        {apps.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Connected Apps</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Apps you connect to will appear here. You can manage permissions and revoke access at
              any time.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {apps.map(app => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-border/50 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* App Icon */}
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        {app.icon ? (
                          <img
                            src={app.icon}
                            alt={app.name}
                            className="w-8 h-8 rounded-lg"
                          />
                        ) : (
                          <Globe className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* App Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{app.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{app.url}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last used {formatTimeAgo(app.lastUsedAt / 1000)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleOpenRevokeDialog(app)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Permissions */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Permissions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {app.permissions.map(permission => (
                          <span
                            key={permission}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs capitalize"
                          >
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Revoke Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access for{' '}
              <span className="font-medium text-foreground">{selectedApp?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              The app will no longer be able to request signatures or view your wallet address.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowRevokeDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleRevoke}>
                Revoke
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
