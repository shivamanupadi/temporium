import { type ReactElement, useState, useCallback, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Plus,
  ShieldOff,
  Shield,
  Clock,
  CalendarIcon,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Coins,
  X,
  Download,
  Info,
  Trash2,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import { isAddress, type Address } from 'viem';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TimePicker } from '@/components/ui/time-picker';
import { cn, formatAddress, copyToClipboard } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { useAccessKeys } from '@/hooks/useAccessKeys';
import { apiPost, apiDelete } from '@/lib/api-client';
import {
  generateSecp256k1Key,
  generateP256Key,
  getSignatureTypeNumber,
  formatExpiry,
  isKeyExpired,
  getKeyStatus,
  type GeneratedKey,
} from '@/lib/access-keys-utils';
import { SpendingLimitsModal } from '@/components/SpendingLimitsModal';
import { TokenAddressPicker } from '@/components/TokenAddressPicker';
import type { AccessKeyType, TokenMetadata } from '@/types';

export const Route = createFileRoute('/portal/access-keys')({
  component: AccessKeysPage,
});

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const EXPIRY_PRESETS = [
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
  { label: 'Never', seconds: 0 },
] as const;

const KEY_TYPES: { id: AccessKeyType; label: string; description: string }[] = [
  {
    id: 'secp256k1',
    label: 'Secp256k1',
    description: 'Standard Ethereum key type. Compatible with all wallets and tools.',
  },
  {
    id: 'p256',
    label: 'P256',
    description: 'NIST P-256 curve. Used by passkeys and secure enclaves.',
  },
];

type WizardStep = 'type' | 'config' | 'limits' | 'save' | 'review';

const STEP_LABELS: Record<WizardStep, { title: string; description: string }> = {
  type: { title: 'Key Type', description: 'Choose the cryptographic key type to generate.' },
  config: { title: 'Configuration', description: 'Set expiry and optional spending limits.' },
  limits: {
    title: 'Spending Limits',
    description: 'Configure token spending limits for this key.',
  },
  save: { title: 'Save Key', description: 'Save your private key securely before proceeding.' },
  review: {
    title: 'Review & Authorize',
    description: 'Review details and authorize the key on-chain.',
  },
};

const isValidHexAddress = (addr: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(addr);

interface SpendingLimitEntry {
  token: string;
  amount: string;
  name: string;
  symbol: string;
  decimals: number;
}

// ---------------------------------------------------------------------------
// Animation variants
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
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Inline copy with tick animation
// ---------------------------------------------------------------------------

function KeyIdWithCopy({ keyId }: { keyId: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] font-mono font-medium text-[#2D3436] truncate">
      {keyId}
      <button
        type="button"
        onClick={async e => {
          e.stopPropagation();
          const success = await copyToClipboard(keyId);
          if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className="shrink-0 text-[#B5B0AA] hover:text-[#6B6560] transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[#5B9A6F]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function AccessKeysPage(): ReactElement {
  const { address } = useTempo();
  const {
    keys,
    isLoading,
    authorizeKey,
    revokeKey,
    updateSpendingLimit,
    getKey,
    getRemainingLimit,
    refresh,
  } = useAccessKeys();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [revokeConfirmKeyId, setRevokeConfirmKeyId] = useState<string | null>(null);

  // --- Spending limits modal state ---
  const [limitsModalKeyId, setLimitsModalKeyId] = useState<string | null>(null);

  // --- Wizard state ---
  const [wizardStep, setWizardStep] = useState<WizardStep>('type');
  const [selectedKeyType, setSelectedKeyType] = useState<AccessKeyType>('secp256k1');
  const [selectedExpiry, setSelectedExpiry] = useState<number | 'custom'>(86400);
  const [customExpiryDate, setCustomExpiryDate] = useState<Date | undefined>(undefined);
  const [customExpiryTime, setCustomExpiryTime] = useState<Date | undefined>(undefined);
  const [enforceLimits, setEnforceLimits] = useState(false);
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimitEntry[]>([]);

  // --- Add Token Limit modal state (wizard only) ---
  const [isTokenLimitModalOpen, setIsTokenLimitModalOpen] = useState(false);
  const [tlAddress, setTlAddress] = useState('');
  const [tlAmount, setTlAmount] = useState('');
  const [tlMetadata, setTlMetadata] = useState<TokenMetadata | null>(null);
  const [tlStep, setTlStep] = useState<'address' | 'amount'>('address');
  const [tlValidating, setTlValidating] = useState(false);
  const [tlError, setTlError] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [keySaved, setKeySaved] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Import dialog state ---
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importKeyId, setImportKeyId] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // --- Delete dialog state ---
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<{ dbId: string; keyId: string } | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Steps are always 5: type → config → limits → save → review
  const steps = useMemo<WizardStep[]>(() => ['type', 'config', 'limits', 'save', 'review'], []);

  const currentStepIndex = steps.indexOf(wizardStep);
  const totalSteps = steps.length;

  // Spending limits validation
  const limitsValid = useMemo(() => {
    if (!enforceLimits) return true;
    if (spendingLimits.length === 0) return true; // limits are optional even when toggle is on
    return spendingLimits.every(
      l => isValidHexAddress(l.token) && l.amount !== '' && parseFloat(l.amount) > 0
    );
  }, [enforceLimits, spendingLimits]);

  const resetForm = useCallback(() => {
    setWizardStep('type');
    setSelectedKeyType('secp256k1');
    setSelectedExpiry(86400);
    setCustomExpiryDate(undefined);
    setCustomExpiryTime(undefined);
    setEnforceLimits(false);
    setSpendingLimits([]);
    setGeneratedKey(null);
    setKeySaved(false);
    setShowPrivateKey(false);
    setIsSubmitting(false);
  }, []);

  const resetTokenLimitModal = useCallback(() => {
    setTlAddress('');
    setTlAmount('');
    setTlMetadata(null);
    setTlStep('address');
    setTlValidating(false);
    setTlError(null);
  }, []);

  const openTokenLimitModal = useCallback(() => {
    resetTokenLimitModal();
    setIsTokenLimitModalOpen(true);
  }, [resetTokenLimitModal]);

  const handleValidateToken = useCallback(async () => {
    const trimmed = tlAddress.trim();
    if (!trimmed) {
      setTlError('Please enter a token address');
      return;
    }
    if (!isAddress(trimmed)) {
      setTlError('Invalid address format');
      return;
    }

    setTlValidating(true);
    setTlError(null);
    try {
      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: trimmed as Address,
      });
      if (!metadata || !metadata.name) {
        setTlError('Token not found or not a valid TIP-20 token');
        return;
      }
      setTlMetadata(metadata as TokenMetadata);
      setTlStep('amount');
    } catch {
      setTlError('Failed to fetch token. Please check the address.');
    } finally {
      setTlValidating(false);
    }
  }, [tlAddress]);

  const handleAddTokenLimit = useCallback(() => {
    if (!tlMetadata || !tlAmount || parseFloat(tlAmount) <= 0) return;

    // Check for duplicate
    if (spendingLimits.some(l => l.token.toLowerCase() === tlAddress.trim().toLowerCase())) {
      setTlError('This token is already in the list');
      return;
    }
    setSpendingLimits([
      ...spendingLimits,
      {
        token: tlAddress.trim(),
        amount: tlAmount,
        name: tlMetadata.name,
        symbol: tlMetadata.symbol,
        decimals: tlMetadata.decimals,
      },
    ]);

    setIsTokenLimitModalOpen(false);
    resetTokenLimitModal();
  }, [tlMetadata, tlAddress, tlAmount, spendingLimits, resetTokenLimitModal]);

  const handleOpenAddDialog = useCallback(() => {
    resetForm();
    setIsAddDialogOpen(true);
  }, [resetForm]);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < totalSteps) {
      // Generate key when entering 'save' step
      if (steps[nextIndex] === 'save') {
        const key = selectedKeyType === 'secp256k1' ? generateSecp256k1Key() : generateP256Key();
        setGeneratedKey(key);
        setKeySaved(false);
        setShowPrivateKey(false);
      }
      setWizardStep(steps[nextIndex]);
    }
  }, [currentStepIndex, totalSteps, steps, selectedKeyType]);

  const goBack = useCallback(() => {
    if (currentStepIndex === 0) {
      setIsAddDialogOpen(false);
    } else {
      setWizardStep(steps[currentStepIndex - 1]);
    }
  }, [currentStepIndex, steps]);

  const handleCopyPrivateKey = useCallback(async () => {
    if (!generatedKey || !('privateKey' in generatedKey)) return;
    try {
      await navigator.clipboard.writeText(generatedKey.privateKey);
      toast.success('Private key copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [generatedKey]);

  const handleCopyKeyId = useCallback(async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey.keyId);
      toast.success('Key ID copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [generatedKey]);

  // Compute expiry timestamp for custom date/time
  const computedExpirySeconds = useMemo(() => {
    if (selectedExpiry !== 'custom') return selectedExpiry;
    if (!customExpiryDate) return null;
    const d = new Date(customExpiryDate);
    if (customExpiryTime) {
      d.setHours(customExpiryTime.getHours(), customExpiryTime.getMinutes(), 0, 0);
    } else {
      d.setHours(23, 59, 59, 0);
    }
    const ts = Math.floor(d.getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    return ts > now ? ts - now : null;
  }, [selectedExpiry, customExpiryDate, customExpiryTime]);

  const handleAuthorizeKey = useCallback(async () => {
    if (!generatedKey) return;

    setIsSubmitting(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const expirySeconds =
        selectedExpiry === 'custom' ? (computedExpirySeconds ?? 0) : selectedExpiry;
      const expiry = expirySeconds === 0 ? 0 : now + expirySeconds;

      const limits = enforceLimits
        ? spendingLimits
            .filter(l => isValidHexAddress(l.token) && l.amount && parseFloat(l.amount) > 0)
            .map(l => ({
              token: l.token as `0x${string}`,
              amount: BigInt(Math.floor(parseFloat(l.amount) * 10 ** (l.decimals || 18))),
            }))
        : [];

      await authorizeKey({
        keyId: generatedKey.keyId,
        signatureType: getSignatureTypeNumber(generatedKey.type),
        expiry,
        enforceLimits,
        limits,
      });

      setIsAddDialogOpen(false);
      resetForm();
      toast.success('Access key authorized', {
        description: `Key ${formatAddress(generatedKey.keyId)} has been registered on-chain.`,
      });
    } catch (err) {
      toast.error('Failed to authorize key', {
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    generatedKey,
    selectedExpiry,
    computedExpirySeconds,
    enforceLimits,
    spendingLimits,
    authorizeKey,
    resetForm,
  ]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!revokeConfirmKeyId) return;
    const keyId = revokeConfirmKeyId;
    setRevokingKeyId(keyId);
    try {
      await revokeKey({ keyId: keyId as `0x${string}` });
      toast.success('Key revoked', {
        description: `Key ${formatAddress(keyId)} has been revoked on-chain.`,
      });
      setRevokeConfirmKeyId(null);
    } catch (err) {
      toast.error('Failed to revoke key', {
        description: (err as Error).message,
      });
    } finally {
      setRevokingKeyId(null);
    }
  }, [revokeConfirmKeyId, revokeKey]);

  const handleImportKey = useCallback(async () => {
    const trimmed = importKeyId.trim();
    if (!trimmed) {
      setImportError('Please enter a key ID');
      return;
    }
    if (!isAddress(trimmed)) {
      setImportError('Invalid address format');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      // Verify key exists on-chain and belongs to this wallet
      const keyData = await getKey(trimmed as Address);
      if (!keyData) {
        setImportError('Key not found on-chain for your wallet');
        return;
      }

      // Save to D1
      await apiPost('/v1/access-keys', {
        keyId: trimmed,
        signatureType: keyData.signatureType,
      });

      toast.success('Access key imported', {
        description: `Key ${formatAddress(trimmed)} has been added to your dashboard.`,
      });

      setIsImportDialogOpen(false);
      setImportKeyId('');
      setImportError(null);
      await refresh();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists') || msg.includes('Conflict')) {
        setImportError('This key is already in your dashboard');
      } else {
        setImportError(msg || 'Failed to import key');
      }
    } finally {
      setIsImporting(false);
    }
  }, [importKeyId, getKey, refresh]);

  const handleDeleteKey = useCallback(async () => {
    if (!deleteConfirmKey) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/v1/access-keys/${deleteConfirmKey.dbId}`);
      toast.success('Key removed from dashboard');
      setDeleteConfirmKey(null);
      await refresh();
    } catch (err) {
      toast.error('Failed to remove key', {
        description: (err as Error).message,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmKey, refresh]);

  // Filter active keys for display count
  const activeKeys = keys.filter(k => !k.isRevoked);

  // Can continue from current step?
  const canContinue = useMemo(() => {
    switch (wizardStep) {
      case 'type':
        return true;
      case 'config':
        return selectedExpiry !== 'custom' || computedExpirySeconds !== null;
      case 'limits':
        return limitsValid;
      case 'save':
        return keySaved;
      case 'review':
        return !isSubmitting;
      default:
        return false;
    }
  }, [wizardStep, selectedExpiry, computedExpirySeconds, limitsValid, keySaved, isSubmitting]);

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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setImportKeyId('');
              setImportError(null);
              setIsImportDialogOpen(true);
            }}
            disabled={!address}
            variant="outline"
            className="h-10 px-5 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-2"
          >
            <Download className="w-4 h-4" />
            Import
          </Button>
          <Button
            onClick={handleOpenAddDialog}
            disabled={!address}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Access Key
          </Button>
        </div>
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
            without exposing your primary wallet credentials. Each key is registered on-chain via
            the AccountKeychain precompile and can be scoped with expiry and spending limits.
          </p>
        </div>
      </motion.div>

      {/* Key List or Empty State */}
      {isLoading ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-[#EDE9E3] bg-white p-12 text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#B5B0AA] mx-auto mb-3" />
          <p className="text-[13px] text-[#9B9590]">Loading keys from chain...</p>
        </motion.div>
      ) : keys.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-[#B5B0AA]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#2D3436]">No access keys</h3>
          <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
            You have not created any session keys yet. Add a key to allow delegated access to
            specific wallet actions.
          </p>
          <Button
            onClick={handleOpenAddDialog}
            disabled={!address}
            variant="outline"
            className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Key
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-3">
          <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
            Keys ({activeKeys.length} active, {keys.length} total)
          </p>
          <AnimatePresence mode="popLayout">
            {keys.map(key => {
              const status = getKeyStatus(key.isRevoked, key.expiry);
              return (
                <motion.div
                  key={key.keyId}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className={`rounded-2xl border bg-white p-5 transition-colors ${
                    status === 'revoked'
                      ? 'border-[#B5B0AA]/30 bg-[#FAFAF9] opacity-60'
                      : status === 'expired'
                        ? 'border-[#E07A5F]/30 bg-[#FEF9F7]'
                        : 'border-[#EDE9E3]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          status === 'revoked'
                            ? 'bg-[#B5B0AA]/10'
                            : status === 'expired'
                              ? 'bg-[#E07A5F]/10'
                              : 'bg-[#9B72CF]/10'
                        }`}
                      >
                        {status === 'expired' ? (
                          <AlertTriangle className="w-5 h-5 text-[#E07A5F]" />
                        ) : (
                          <Key className="w-5 h-5 text-[#9B72CF]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <KeyIdWithCopy keyId={key.keyId} />

                        {/* Key metadata */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5F2ED] text-[11px] font-medium text-[#6B6560]">
                            {key.signatureType}
                          </span>
                          {key.enforceLimits && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#9B72CF]/10 text-[11px] font-medium text-[#9B72CF]">
                              <Shield className="w-3 h-3" />
                              limits
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              status === 'active'
                                ? 'bg-[#5B9A6F]/10 text-[#5B9A6F]'
                                : status === 'expired'
                                  ? 'bg-[#E07A5F]/10 text-[#E07A5F]'
                                  : 'bg-[#B5B0AA]/10 text-[#B5B0AA]'
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        {/* Expiry */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="w-3.5 h-3.5 text-[#B5B0AA]" />
                          <span
                            className={`text-[12px] ${
                              isKeyExpired(key.expiry)
                                ? 'text-[#E07A5F] font-semibold'
                                : 'text-[#9B9590]'
                            }`}
                          >
                            {formatExpiry(key.expiry)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!key.isRevoked ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLimitsModalKeyId(key.keyId)}
                            className="h-8 rounded-lg text-[11px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-1.5"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            Manage Limits
                          </Button>
                          <Button
                            onClick={() => setRevokeConfirmKeyId(key.keyId)}
                            disabled={revokingKeyId === key.keyId}
                            className="h-9 px-3 rounded-lg text-[12px] font-semibold text-[#E07A5F] bg-[#E07A5F]/10 hover:bg-[#E07A5F]/20 gap-1.5"
                          >
                            {revokingKeyId === key.keyId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldOff className="w-3.5 h-3.5" />
                            )}
                            Revoke
                          </Button>
                        </>
                      ) : key.dbId ? (
                        <Button
                          onClick={() => setDeleteConfirmKey({ dbId: key.dbId!, keyId: key.keyId })}
                          className="h-9 px-3 rounded-lg text-[12px] font-semibold text-[#B5B0AA] bg-[#F5F2ED] hover:bg-[#EDE9E3] gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={revokeConfirmKeyId !== null}
        onOpenChange={open => {
          if (!open && !revokingKeyId) setRevokeConfirmKeyId(null);
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">Revoke Key</DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              This action will revoke the key on-chain and cannot be undone.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />
          <div className="px-6 py-5">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E07A5F]/[0.06] border border-[#E07A5F]/15">
              <AlertTriangle className="w-4 h-4 text-[#E07A5F] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#E07A5F]/80 leading-relaxed">
                Key{' '}
                <span className="font-mono font-medium">
                  {revokeConfirmKeyId ? formatAddress(revokeConfirmKeyId, 6) : ''}
                </span>{' '}
                will be permanently revoked. Any application using this key will lose access
                immediately.
              </p>
            </div>
          </div>
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setRevokeConfirmKeyId(null)}
              disabled={!!revokingKeyId}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRevoke}
              disabled={!!revokingKeyId}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E5484D] hover:bg-[#E5484D]/90 text-white gap-2"
            >
              {revokingKeyId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" />
                  Revoke Key
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Access Key Dialog */}
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={open => {
          if (!open && !isImporting) {
            setIsImportDialogOpen(false);
            setImportKeyId('');
            setImportError(null);
          }
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[420px] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Import Access Key
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Add an existing on-chain access key to your dashboard.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#6B8EAD]/[0.06] border border-[#6B8EAD]/15">
              <Info className="w-4 h-4 text-[#6B8EAD] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#6B8EAD]/80 leading-relaxed">
                This only imports key metadata (ID, type, status) for display and management.
                Private keys are never stored or transmitted — importing is completely safe.
              </p>
            </div>
            <div>
              <Label className="text-[12px] font-semibold text-[#6B6560] mb-1.5 block">
                Key ID (Address)
              </Label>
              <Input
                placeholder="0x..."
                value={importKeyId}
                onChange={e => {
                  setImportKeyId(e.target.value);
                  setImportError(null);
                }}
                className="h-11 rounded-xl border-[#EDE9E3] text-[13px] font-mono placeholder:text-[#D5D0CA]"
              />
              {importError && (
                <p className="text-[12px] text-[#E07A5F] mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {importError}
                </p>
              )}
            </div>
          </div>
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportKeyId('');
                setImportError(null);
              }}
              disabled={isImporting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportKey}
              disabled={isImporting || !importKeyId.trim()}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import Key
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmKey !== null}
        onOpenChange={open => {
          if (!open && !isDeleting) setDeleteConfirmKey(null);
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[380px] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">Remove Key</DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Remove this revoked key from your dashboard.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#6B8EAD]/[0.06] border border-[#6B8EAD]/15">
              <Info className="w-4 h-4 text-[#6B8EAD] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#6B8EAD]/80 leading-relaxed">
                This only removes the key from your dashboard view. The key is already revoked
                on-chain and will remain revoked — no on-chain state is affected. You can always
                re-import it later using the key ID.
              </p>
            </div>
            {deleteConfirmKey && (
              <div className="p-3 rounded-xl bg-[#F5F2ED]/60">
                <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                  Key ID
                </p>
                <p className="text-[12px] font-mono text-[#2D3436] break-all">
                  {deleteConfirmKey.keyId}
                </p>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmKey(null)}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteKey}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#E07A5F]/80 text-white gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Remove
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Token Limit Modal (wizard — add token during key creation) */}
      <Dialog
        open={isTokenLimitModalOpen}
        onOpenChange={open => {
          if (!open) {
            setIsTokenLimitModalOpen(false);
            resetTokenLimitModal();
          }
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[400px]">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Add Token Limit
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Look up a token on-chain and set a spending limit.
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />

          {tlStep === 'address' ? (
            <div className="px-6 py-5 space-y-4">
              <TokenAddressPicker
                value={tlAddress}
                onChange={val => {
                  setTlAddress(val);
                  setTlError(null);
                }}
                label="Token Address"
                showValidation={false}
              />
              {tlError && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11px] text-[#E5484D]">{tlError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {tlMetadata && (
                <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Token</span>
                    <span className="text-[12px] font-semibold text-[#2D3436]">
                      {tlMetadata.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Symbol</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      {tlMetadata.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Decimals</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      {tlMetadata.decimals}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Address</span>
                    <span className="text-[11px] font-mono text-[#9B9590]">
                      {formatAddress(tlAddress.trim(), 6)}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Spending Limit Amount
                </Label>
                <Input
                  placeholder="0.00"
                  type="number"
                  value={tlAmount}
                  onChange={e => setTlAmount(e.target.value)}
                  className="h-10 rounded-xl text-[13px] border-[#EDE9E3]"
                />
                {tlMetadata && (
                  <p className="text-[11px] text-[#B5B0AA]">
                    Maximum amount of {tlMetadata.symbol} this key can spend.
                  </p>
                )}
              </div>
              {tlError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11px] text-[#E5484D]">{tlError}</p>
                </div>
              )}
            </div>
          )}

          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (tlStep === 'amount') {
                  setTlStep('address');
                  setTlMetadata(null);
                  setTlAmount('');
                  setTlError(null);
                } else {
                  setIsTokenLimitModalOpen(false);
                  resetTokenLimitModal();
                }
              }}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              {tlStep === 'amount' ? 'Back' : 'Cancel'}
            </Button>
            {tlStep === 'address' ? (
              <Button
                onClick={handleValidateToken}
                disabled={tlValidating || !tlAddress.trim()}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
              >
                {tlValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Look Up Token
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAddTokenLimit}
                disabled={!tlAmount || parseFloat(tlAmount) <= 0}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Token
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Spending Limits CRUD Modal */}
      {(() => {
        const targetKey = limitsModalKeyId ? keys.find(k => k.keyId === limitsModalKeyId) : null;
        return (
          <SpendingLimitsModal
            keyId={limitsModalKeyId ?? ''}
            isOpen={limitsModalKeyId !== null}
            onClose={() => setLimitsModalKeyId(null)}
            enforceLimits={targetKey?.enforceLimits ?? false}
            updateSpendingLimit={updateSpendingLimit}
            getRemainingLimit={getRemainingLimit}
            onUpdated={refresh}
          />
        );
      })()}

      {/* Add Access Key Dialog — Multi-Step Wizard */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={open => {
          if (!open) resetForm();
          setIsAddDialogOpen(open);
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[420px] overflow-hidden">
          {/* Header with step indicator */}
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              {STEP_LABELS[wizardStep].title}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              {STEP_LABELS[wizardStep].description}
            </DialogDescription>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-4">
              {steps.map((step, idx) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0 transition-colors ${
                      idx < currentStepIndex
                        ? 'bg-coral text-white'
                        : idx === currentStepIndex
                          ? 'bg-coral text-white'
                          : 'bg-[#F5F2ED] text-[#B5B0AA]'
                    }`}
                  >
                    {idx < currentStepIndex ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < totalSteps - 1 && (
                    <div
                      className={`h-[2px] flex-1 rounded-full transition-colors ${
                        idx < currentStepIndex ? 'bg-coral' : 'bg-[#EDE9E3]'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#EDE9E3]/60" />

          {/* Step content */}
          <div className="px-6 py-5 min-h-[200px]">
            <AnimatePresence mode="wait">
              {/* Step: Key Type Selection */}
              {wizardStep === 'type' && (
                <motion.div
                  key="step-type"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2.5"
                >
                  {KEY_TYPES.map(keyType => {
                    const isSelected = selectedKeyType === keyType.id;
                    return (
                      <button
                        key={keyType.id}
                        type="button"
                        onClick={() => setSelectedKeyType(keyType.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'border-coral/40 bg-coral/[0.04]'
                            : 'border-[#EDE9E3] bg-white hover:border-[#D5D0CA]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-coral bg-coral' : 'border-[#D5D0CA]'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#2D3436]">
                            {keyType.label}
                          </p>
                          <p className="text-[11px] text-[#9B9590]">{keyType.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* Step: Configuration (Expiry with presets + custom date/time) */}
              {wizardStep === 'config' && (
                <motion.div
                  key="step-config"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Quick presets */}
                  <div className="space-y-2.5">
                    <Label className="text-[12px] font-semibold text-[#6B6560] uppercase tracking-wider">
                      Expiry
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {EXPIRY_PRESETS.map(preset => (
                        <button
                          key={preset.seconds}
                          type="button"
                          onClick={() => {
                            setSelectedExpiry(preset.seconds);
                            setCustomExpiryDate(undefined);
                            setCustomExpiryTime(undefined);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                            selectedExpiry === preset.seconds
                              ? 'bg-coral text-white'
                              : 'bg-[#F5F2ED] text-[#6B6560] hover:bg-[#EDE9E3]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedExpiry('custom')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                          selectedExpiry === 'custom'
                            ? 'bg-coral text-white'
                            : 'bg-[#F5F2ED] text-[#6B6560] hover:bg-[#EDE9E3]'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {selectedExpiry !== 'custom' && (
                      <p className="text-[11px] text-[#B5B0AA]">
                        {selectedExpiry === 0
                          ? 'This key will not expire. Revoke it manually when no longer needed.'
                          : `Expires ${EXPIRY_PRESETS.find(p => p.seconds === selectedExpiry)?.label.toLowerCase()} after creation.`}
                      </p>
                    )}
                  </div>

                  {/* Custom date/time picker */}
                  {selectedExpiry === 'custom' && (
                    <div className="space-y-2.5">
                      <Label className="text-[12px] font-semibold text-[#6B6560] uppercase tracking-wider">
                        Expiry Date & Time
                      </Label>
                      <div className="flex gap-2">
                        {/* Date picker */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'flex-1 h-10 justify-start text-left font-normal rounded-xl border-[#EDE9E3]',
                                customExpiryDate && 'border-coral/40 bg-coral/[0.03]',
                                !customExpiryDate && 'text-[#B5B0AA]'
                              )}
                            >
                              <CalendarIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
                              <span className="text-[13px]">
                                {customExpiryDate
                                  ? format(customExpiryDate, 'MMM d, yyyy')
                                  : 'Pick date'}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              selected={customExpiryDate}
                              onSelect={date => {
                                setCustomExpiryDate(date);
                                if (!customExpiryTime) {
                                  const now = new Date();
                                  now.setHours(now.getHours() + 1, 0, 0, 0);
                                  setCustomExpiryTime(now);
                                }
                              }}
                              disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Time picker */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'w-[130px] h-10 justify-start text-left font-normal rounded-xl border-[#EDE9E3]',
                                customExpiryTime &&
                                  customExpiryDate &&
                                  'border-coral/40 bg-coral/[0.03]',
                                !customExpiryTime && 'text-[#B5B0AA]'
                              )}
                            >
                              <Clock className="w-3.5 h-3.5 mr-2 shrink-0" />
                              <span className="text-[13px]">
                                {customExpiryTime ? format(customExpiryTime, 'hh:mm aa') : 'Time'}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit p-0" align="start">
                            <TimePicker date={customExpiryTime} setDate={setCustomExpiryTime} />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {customExpiryDate && computedExpirySeconds !== null && (
                        <p className="text-[11px] text-[#B5B0AA]">
                          Expires on {format(customExpiryDate, 'MMM d, yyyy')}
                          {customExpiryTime ? ` at ${format(customExpiryTime, 'hh:mm aa')}` : ''}.
                        </p>
                      )}
                      {customExpiryDate && computedExpirySeconds === null && (
                        <p className="text-[11px] text-[#E5484D]">
                          Selected date/time is in the past.
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step: Spending Limits */}
              {wizardStep === 'limits' && (
                <motion.div
                  key="step-limits"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {/* Enable/Disable toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[#EDE9E3]">
                    <div>
                      <Label className="text-[12px] font-semibold text-[#6B6560]">
                        Enable Spending Limits
                      </Label>
                      <p className="text-[11px] text-[#B5B0AA] mt-0.5">
                        Restrict token spending for this key.
                      </p>
                    </div>
                    <Switch
                      checked={enforceLimits}
                      onCheckedChange={checked => {
                        setEnforceLimits(checked);
                        if (!checked) setSpendingLimits([]);
                      }}
                    />
                  </div>

                  {!enforceLimits && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]">
                      <Shield className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[#9B9590] leading-relaxed">
                        Spending limits are disabled. This key will have unrestricted spending
                        access. You can enable limits now or update them after creation.
                      </p>
                    </div>
                  )}

                  {enforceLimits && (
                    <>
                      {spendingLimits.length > 0 && (
                        <div className="space-y-2">
                          {spendingLimits.map((limit, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-2.5 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8]"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-[#2D3436]">
                                  {limit.symbol}{' '}
                                  <span className="font-normal text-[#9B9590]">({limit.name})</span>
                                </p>
                                <p className="text-[11px] text-[#9B9590] font-mono truncate">
                                  {formatAddress(limit.token, 6)}
                                </p>
                              </div>
                              <span className="text-[12px] font-medium text-[#2D3436] shrink-0">
                                {limit.amount}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setSpendingLimits(spendingLimits.filter((_, i) => i !== index))
                                }
                                className="w-7 h-7 rounded-lg shrink-0 text-[#B5B0AA] hover:text-[#E07A5F]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => openTokenLimitModal()}
                        className="w-full h-9 rounded-lg text-[12px] font-medium border-dashed border-[#EDE9E3] text-[#9B9590] gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Token Limit
                      </Button>

                      {spendingLimits.length === 0 && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]">
                          <Shield className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
                          <p className="text-[11px] text-[#9B9590] leading-relaxed">
                            No limits added yet. You can continue without limits and add them later,
                            or add specific token limits now.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* Step: Save Generated Key */}
              {wizardStep === 'save' && generatedKey && (
                <motion.div
                  key="step-save"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-coral/[0.06] border border-coral/15">
                    <AlertTriangle className="w-4 h-4 text-coral shrink-0 mt-0.5" />
                    <p className="text-[12px] text-coral/80 leading-relaxed">
                      Save your private key now. It cannot be recovered after closing this dialog.
                    </p>
                  </div>

                  {/* Key ID */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Key ID (Address)
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-[#F5F2ED] px-3 py-2 font-mono text-[12px] text-[#2D3436] truncate">
                        {generatedKey.keyId}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyKeyId}
                        className="w-8 h-8 rounded-lg shrink-0 text-[#B5B0AA] hover:text-[#6B6560]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Private Key */}
                  {'privateKey' in generatedKey && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Private Key
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-lg bg-[#F5F2ED] px-3 py-2 font-mono text-[12px] text-[#2D3436] truncate">
                          {showPrivateKey ? generatedKey.privateKey : '\u2022'.repeat(32)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="w-8 h-8 rounded-lg shrink-0 text-[#B5B0AA] hover:text-[#6B6560]"
                        >
                          {showPrivateKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyPrivateKey}
                          className="w-8 h-8 rounded-lg shrink-0 text-[#B5B0AA] hover:text-[#6B6560]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confirmation checkbox */}
                  <button
                    type="button"
                    onClick={() => setKeySaved(!keySaved)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      keySaved
                        ? 'border-coral/40 bg-coral/[0.04]'
                        : 'border-[#EDE9E3] bg-white hover:border-[#D5D0CA]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        keySaved ? 'border-coral bg-coral' : 'border-[#D5D0CA]'
                      }`}
                    >
                      {keySaved && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <p className="text-[12px] text-[#6B6560] text-left">
                      I have saved my private key securely
                    </p>
                  </button>
                </motion.div>
              )}

              {/* Step: Review & Authorize */}
              {wizardStep === 'review' && generatedKey && (
                <motion.div
                  key="step-review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#EDE9E3]/60">
                      <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Summary
                      </p>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Key Type</span>
                        <span className="text-[12px] font-medium text-[#2D3436] capitalize">
                          {generatedKey.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Key ID</span>
                        <span className="text-[12px] font-mono font-medium text-[#2D3436]">
                          {formatAddress(generatedKey.keyId, 6)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Expiry</span>
                        <span className="text-[12px] font-medium text-[#2D3436]">
                          {selectedExpiry === 'custom' && customExpiryDate
                            ? `${format(customExpiryDate, 'MMM d, yyyy')}${customExpiryTime ? ` ${format(customExpiryTime, 'hh:mm aa')}` : ''}`
                            : selectedExpiry === 0
                              ? 'Never'
                              : EXPIRY_PRESETS.find(p => p.seconds === selectedExpiry)?.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Spending Limits</span>
                        <span className="text-[12px] font-medium text-[#2D3436]">
                          {enforceLimits
                            ? spendingLimits.filter(l => isValidHexAddress(l.token) && l.amount)
                                .length > 0
                              ? `${spendingLimits.filter(l => isValidHexAddress(l.token) && l.amount).length} token(s)`
                              : 'Enabled (no limits set)'
                            : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    {/* Show individual limits in summary */}
                    {enforceLimits &&
                      spendingLimits.filter(l => isValidHexAddress(l.token) && l.amount).length >
                        0 && (
                        <div className="px-4 py-2.5 border-t border-[#EDE9E3]/60 space-y-1.5">
                          {spendingLimits
                            .filter(l => isValidHexAddress(l.token) && l.amount)
                            .map((l, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-[#9B9590]">
                                  {l.symbol || formatAddress(l.token, 6)}
                                </span>
                                <span className="text-[11px] font-medium text-[#2D3436]">
                                  {l.amount} {l.symbol}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#9B72CF]/[0.06] border border-[#9B72CF]/15">
                    <Shield className="w-4 h-4 text-[#9B72CF] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#9B72CF]/80 leading-relaxed">
                      Clicking &ldquo;Authorize Key&rdquo; will send a transaction to the
                      AccountKeychain precompile. Your wallet will prompt you to sign.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-2"
            >
              {currentStepIndex === 0 ? (
                'Cancel'
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </>
              )}
            </Button>

            {wizardStep === 'review' ? (
              <Button
                onClick={handleAuthorizeKey}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Authorize Key
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!canContinue}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
