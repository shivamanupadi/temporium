import { type ReactElement, useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Plus,
  Trash2,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@temporium/shared-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress, isValidAddress } from '@/lib/utils';

export const Route = createFileRoute('/portal/access-keys')({
  component: AccessKeysPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessKey {
  address: string;
  permissions: Permission[];
  expiresAt: number; // unix seconds, 0 = never
  createdAt: number;
}

type Permission = 'transfer' | 'swap' | 'approve' | 'stake' | 'admin';

const AVAILABLE_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: 'transfer', label: 'Transfer', description: 'Send tokens on your behalf' },
  { id: 'swap', label: 'Swap', description: 'Execute token swaps' },
  { id: 'approve', label: 'Approve', description: 'Set token allowances' },
  { id: 'stake', label: 'Stake', description: 'Manage staking positions' },
  { id: 'admin', label: 'Admin', description: 'Full administrative access' },
];

const EXPIRY_PRESETS = [
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
  { label: 'Never', seconds: 0 },
] as const;

// ---------------------------------------------------------------------------
// Animation variants (consistent with dashboard)
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpiry(expiresAt: number): string {
  if (expiresAt === 0) return 'Never';
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now) return 'Expired';

  const diff = expiresAt - now;
  if (diff < 3600) return `${Math.floor(diff / 60)}m remaining`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h remaining`;
  return `${Math.floor(diff / 86400)}d remaining`;
}

function isExpired(expiresAt: number): boolean {
  if (expiresAt === 0) return false;
  return expiresAt <= Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function AccessKeysPage(): ReactElement {
  const { address } = useTempo();

  // Mock state -- will be replaced with AccountKeychain precompile reads
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [revokingAddress, setRevokingAddress] = useState<string | null>(null);

  // --- Add Key form state ---
  const [newKeyAddress, setNewKeyAddress] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['transfer']);
  const [selectedExpiry, setSelectedExpiry] = useState<number>(86400);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setNewKeyAddress('');
    setSelectedPermissions(['transfer']);
    setSelectedExpiry(86400);
  }, []);

  const handleOpenAddDialog = useCallback(() => {
    resetForm();
    setIsAddDialogOpen(true);
  }, [resetForm]);

  const togglePermission = useCallback((perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm)
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    );
  }, []);

  const handleAddKey = useCallback(async () => {
    if (!newKeyAddress || !isValidAddress(newKeyAddress)) {
      toast.error('Invalid address', { description: 'Please enter a valid Ethereum address.' });
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error('No permissions selected', { description: 'Select at least one permission for this key.' });
      return;
    }

    if (keys.some(k => k.address.toLowerCase() === newKeyAddress.toLowerCase())) {
      toast.error('Key already exists', { description: 'This address is already registered as an access key.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Replace with AccountKeychain precompile call
      // await Actions.keychain.addKey(walletClient, { key: newKeyAddress, permissions, expiry })
      await new Promise(resolve => setTimeout(resolve, 800));

      const now = Math.floor(Date.now() / 1000);
      const newKey: AccessKey = {
        address: newKeyAddress,
        permissions: selectedPermissions,
        expiresAt: selectedExpiry === 0 ? 0 : now + selectedExpiry,
        createdAt: now,
      };

      setKeys(prev => [newKey, ...prev]);
      setIsAddDialogOpen(false);
      resetForm();
      toast.success('Access key added', {
        description: `Key ${formatAddress(newKeyAddress)} has been registered.`,
      });
    } catch (err) {
      toast.error('Failed to add key', {
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [newKeyAddress, selectedPermissions, selectedExpiry, keys, resetForm]);

  const handleRevokeKey = useCallback(async (keyAddress: string) => {
    setRevokingAddress(keyAddress);
    try {
      // TODO: Replace with AccountKeychain precompile call
      // await Actions.keychain.revokeKey(walletClient, { key: keyAddress })
      await new Promise(resolve => setTimeout(resolve, 600));

      setKeys(prev => prev.filter(k => k.address !== keyAddress));
      toast.success('Key revoked', {
        description: `Key ${formatAddress(keyAddress)} has been removed.`,
      });
    } catch (err) {
      toast.error('Failed to revoke key', {
        description: (err as Error).message,
      });
    } finally {
      setRevokingAddress(null);
    }
  }, []);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Access Keys</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Manage session keys that can act on behalf of your wallet.
          </p>
        </div>
        <Button
          onClick={handleOpenAddDialog}
          disabled={!address}
          className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Key
        </Button>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-[#EDE9E3] bg-[#FDFBF8] p-4 flex items-start gap-3"
      >
        <div className="w-9 h-9 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center shrink-0 mt-0.5">
          <Shield className="w-4.5 h-4.5 text-[#E07A5F]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#2D3436]">Session Key Management</p>
          <p className="text-[12px] text-[#9B9590] mt-0.5 leading-relaxed">
            Access keys allow third-party apps or devices to perform specific actions on your behalf
            without exposing your primary wallet credentials. Each key can be scoped to limited
            permissions and set to expire automatically.
          </p>
        </div>
      </motion.div>

      {/* Key List or Empty State */}
      {keys.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-[#B5B0AA]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#2D3436]">No access keys</h3>
          <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
            You have not created any session keys yet. Add a key to allow delegated
            access to specific wallet actions with fine-grained permissions.
          </p>
          <Button
            onClick={handleOpenAddDialog}
            disabled={!address}
            className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Key
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-3">
          <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
            Active Keys ({keys.length})
          </p>
          <AnimatePresence mode="popLayout">
            {keys.map((key) => (
              <motion.div
                key={key.address}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className={`rounded-2xl border bg-white p-5 transition-colors ${
                  isExpired(key.expiresAt)
                    ? 'border-[#E07A5F]/30 bg-[#FEF9F7]'
                    : 'border-[#EDE9E3]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Key Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpired(key.expiresAt) ? 'bg-[#E07A5F]/10' : 'bg-[#9B72CF]/10'
                    }`}>
                      {isExpired(key.expiresAt) ? (
                        <AlertTriangle className="w-5 h-5 text-[#E07A5F]" />
                      ) : (
                        <Key className="w-5 h-5 text-[#9B72CF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-mono font-medium text-[#2D3436] truncate">
                        {formatAddress(key.address, 8)}
                      </p>

                      {/* Permissions */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {key.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5F2ED] text-[11px] font-medium text-[#6B6560]"
                          >
                            <Shield className="w-3 h-3" />
                            {perm}
                          </span>
                        ))}
                      </div>

                      {/* Expiry */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock className="w-3.5 h-3.5 text-[#B5B0AA]" />
                        <span className={`text-[12px] ${
                          isExpired(key.expiresAt) ? 'text-[#E07A5F] font-semibold' : 'text-[#9B9590]'
                        }`}>
                          {formatExpiry(key.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Revoke Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevokeKey(key.address)}
                    disabled={revokingAddress === key.address}
                    className="w-9 h-9 rounded-lg text-[#B5B0AA] hover:text-[#E07A5F] hover:bg-[#E07A5F]/10 shrink-0"
                  >
                    {revokingAddress === key.address ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add Key Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="p-0 gap-0">
          <div className="p-6 pb-0">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Add Access Key
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Register a new session key with scoped permissions.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5">
            {/* Address Input */}
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold text-[#6B6560] uppercase tracking-wider">
                Key Address
              </Label>
              <Input
                value={newKeyAddress}
                onChange={(e) => setNewKeyAddress(e.target.value)}
                placeholder="0x..."
                className="h-11 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] text-[14px] font-mono placeholder:text-[#C5C0BA] focus:border-[#9B72CF] focus:ring-1 focus:ring-[#9B72CF]/20"
              />
              <p className="text-[11px] text-[#B5B0AA]">
                The address that will be granted delegated access.
              </p>
            </div>

            {/* Permissions */}
            <div className="space-y-2.5">
              <Label className="text-[12px] font-semibold text-[#6B6560] uppercase tracking-wider">
                Permissions
              </Label>
              <div className="space-y-2">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const isSelected = selectedPermissions.includes(perm.id);
                  return (
                    <button
                      key={perm.id}
                      type="button"
                      onClick={() => togglePermission(perm.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#9B72CF]/40 bg-[#9B72CF]/5'
                          : 'border-[#EDE9E3] bg-white hover:border-[#D5D0CA]'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-[#9B72CF] bg-[#9B72CF]'
                          : 'border-[#D5D0CA]'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#2D3436]">{perm.label}</p>
                        <p className="text-[11px] text-[#9B9590]">{perm.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expiry */}
            <div className="space-y-2.5">
              <Label className="text-[12px] font-semibold text-[#6B6560] uppercase tracking-wider">
                Expiry
              </Label>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setSelectedExpiry(preset.seconds)}
                    className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                      selectedExpiry === preset.seconds
                        ? 'bg-[#2D3436] text-white'
                        : 'bg-[#F5F2ED] text-[#6B6560] hover:bg-[#EDE9E3]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#B5B0AA]">
                {selectedExpiry === 0
                  ? 'This key will not expire automatically. Revoke it manually when no longer needed.'
                  : `This key will expire ${EXPIRY_PRESETS.find(p => p.seconds === selectedExpiry)?.label.toLowerCase()} after creation.`}
              </p>
            </div>

            {/* Warning for admin */}
            {selectedPermissions.includes('admin') && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E07A5F]/8 border border-[#E07A5F]/20">
                <AlertTriangle className="w-4 h-4 text-[#E07A5F] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#E07A5F] leading-relaxed">
                  Admin permission grants full control over your wallet. Only assign this to
                  addresses you fully trust.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddKey}
              disabled={isSubmitting || !newKeyAddress}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Add Key
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
