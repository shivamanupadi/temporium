import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Trash2, Shield, Clock, Link2, PenTool, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { getConnectedApps, removeConnectedApp } from '@/lib/connected-apps';
import { formatTimeAgo, cn } from '@/lib/utils';
import type { ConnectedApp, AppPermission } from '@/types';

export const Route = createFileRoute('/wallet/apps')({
  component: AppsPage,
});

const permissionConfig: Record<
  AppPermission,
  { icon: typeof Link2; label: string; color: string }
> = {
  connect: { icon: Link2, label: 'Connect', color: '#5B9A6F' },
  sign: { icon: PenTool, label: 'Sign', color: '#9B72CF' },
  send: { icon: Send, label: 'Send', color: '#9B72CF' },
};

function AppsPage(): ReactElement {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<ConnectedApp | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  useEffect(() => {
    const loadApps = (): void => {
      const connectedApps = getConnectedApps();
      connectedApps.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      setApps(connectedApps);
    };

    loadApps();

    const handleStorage = (e: StorageEvent): void => {
      if (e.key === 'temporium_connected_apps') {
        loadApps();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleRevoke = (): void => {
    if (!selectedApp) return;

    removeConnectedApp(selectedApp.id);
    setShowRevokeDialog(false);
    setApps(prev => prev.filter(app => app.id !== selectedApp.id));
    toast.success(`Revoked access for ${selectedApp.name}`);
    setSelectedApp(null);
  };

  const handleOpenRevokeDialog = (app: ConnectedApp): void => {
    setSelectedApp(app);
    setShowRevokeDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#2D3436]">Connected Apps</h1>
          <p className="text-[13px] text-muted-foreground">
            {apps.length === 0
              ? 'No apps connected'
              : `${apps.length} app${apps.length !== 1 ? 's' : ''} connected`}
          </p>
        </div>
      </motion.div>

      {/* Content */}
      {apps.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Connected Apps</h2>
            <p className="text-[13px] text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              Apps you connect to will appear here. You can manage permissions and revoke access at
              any time.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="popLayout">
            {apps.map((app, index) => {
              const isLast = index === apps.length - 1;

              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className={cn(
                    'px-6 py-4 hover:bg-[#FDFBF8] transition-colors',
                    !isLast && 'border-b border-border/20'
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    {/* App Icon */}
                    <div className="w-11 h-11 rounded-xl bg-[#F5F2ED] flex items-center justify-center shrink-0 overflow-hidden">
                      {app.icon ? (
                        <img
                          src={app.icon}
                          alt={app.name}
                          className="w-11 h-11 rounded-xl object-cover"
                        />
                      ) : (
                        <Globe className="w-5 h-5 text-[#9B9590]" />
                      )}
                    </div>

                    {/* App Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[14px] font-semibold text-[#2D3436] truncate">
                          {app.name}
                        </h3>
                        <div className="flex items-center gap-1 text-[10px] text-[#5B9A6F] font-medium shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F]" />
                          Active
                        </div>
                      </div>

                      <p className="text-[12px] text-[#9B9590] truncate mb-2.5">{app.url}</p>

                      {/* Permissions + Time row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {app.permissions.map(permission => {
                          const config = permissionConfig[permission];
                          const Icon = config.icon;
                          return (
                            <span
                              key={permission}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${config.color}10`,
                                color: config.color,
                              }}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {config.label}
                            </span>
                          );
                        })}

                        <span className="text-[10px] text-[#B5B0AA] flex items-center gap-1 ml-auto">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(app.lastUsedAt / 1000)}
                        </span>
                      </div>
                    </div>

                    {/* Revoke */}
                    <button
                      onClick={() => handleOpenRevokeDialog(app)}
                      className="w-8 h-8 rounded-lg border border-border/30 hover:border-red-200 bg-[#FDFBF8] hover:bg-red-50 flex items-center justify-center transition-all group shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#B5B0AA] group-hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="max-w-[320px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Revoke Access</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm revoking access for {selectedApp?.name}
          </DialogDescription>

          <div className="relative px-6 pt-8 pb-5 text-center">
            {/* Gradient wash */}
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.04] to-transparent pointer-events-none" />

            <div className="relative">
              {/* Warning icon */}
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>

              <h3 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">Revoke Access?</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-[#2D3436]">{selectedApp?.name}</span> will no
                longer be able to request signatures or view your wallet address.
              </p>
            </div>
          </div>

          {/* App preview card */}
          {selectedApp && (
            <div className="mx-5 mb-5">
              <div className="bg-[#FDFBF8] rounded-xl border border-border/30 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F2ED] flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedApp.icon ? (
                    <img
                      src={selectedApp.icon}
                      alt={selectedApp.name}
                      className="w-9 h-9 rounded-xl object-cover"
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-[#9B9590]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#2D3436] truncate">
                    {selectedApp.name}
                  </p>
                  <p className="text-[11px] text-[#9B9590] truncate">{selectedApp.url}</p>
                </div>
                <div className="flex gap-1">
                  {selectedApp.permissions.map(permission => {
                    const config = permissionConfig[permission];
                    const Icon = config.icon;
                    return (
                      <div
                        key={permission}
                        className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${config.color}10` }}
                        title={config.label}
                      >
                        <Icon className="w-2.5 h-2.5" style={{ color: config.color }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 pb-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
              onClick={() => setShowRevokeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
              onClick={handleRevoke}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
