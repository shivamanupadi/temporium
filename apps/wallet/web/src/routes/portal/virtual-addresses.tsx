import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Plus,
  Copy,
  Check,
  Loader2,
  Trash2,
  Share2,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { useVirtualAddresses, useVirtualMaster } from '@/hooks/useVirtualAddresses';
import { RegisterMasterDialog } from '@/components/RegisterMasterDialog';
import {
  CreateVirtualAddressDialog,
  LookupMasterDialog,
} from '@/components/VirtualAddressDialogs';
import type { VirtualAddress } from '@/lib/virtual-addresses-api';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/portal/virtual-addresses')({
  component: VirtualAddressesPage,
});

// -----------------------------------------------------------------------------
// Animation
// -----------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function VirtualAddressesPage(): ReactElement {
  const navigate = useNavigate();

  const {
    registeredMaster,
    pendingMaster,
    isLoading: isMasterLoading,
    refresh: refreshMaster,
    recover,
  } = useVirtualMaster();
  const { addresses, isLoading: isListLoading, remove, refresh } = useVirtualAddresses();
  const master = registeredMaster;

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VirtualAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refresh(), refreshMaster()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh, refreshMaster]);

  const handleCopy = useCallback(async (item: VirtualAddress) => {
    const ok = await copyToClipboard(item.address);
    if (!ok) return;
    setCopiedId(item.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), TIMING.COPY_FEEDBACK_MS);
  }, []);

  const handleRecover = useCallback(async () => {
    setIsRecovering(true);
    try {
      const found = await recover();
      toast.success('Master ID recovered', { description: found.masterId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recovery failed';
      toast.error("Couldn't find your master ID", { description: msg });
    } finally {
      setIsRecovering(false);
    }
  }, [recover]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Address removed');
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error('Could not delete', { description: msg });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, remove]);

  const isLoading = isMasterLoading || (master && isListLoading);

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
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Virtual addresses</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Hand out unique deposit addresses per counterparty. All forward to your main wallet.
          </p>
          {master && <MasterIdBadge masterId={master.masterId} />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={!!isLoading || isRefreshing}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          {/* Import-virtual-address button intentionally hidden for now.
              Reinstate by un-commenting and re-rendering ImportVirtualAddressDialog below.
          {master && (
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              <span className="hidden sm:inline">Import</span>
            </Button>
          )} */}
          {master && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New address
            </Button>
          )}
        </div>
      </motion.div>

      {/* Filter tabs */}
      {/* Body */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <LoadingState />
        ) : !master ? (
          <UnregisteredState
            isPending={!!pendingMaster}
            isRecovering={isRecovering}
            onRegister={() => setIsRegisterOpen(true)}
            onLookup={() => setIsLookupOpen(true)}
            onRecover={handleRecover}
          />
        ) : addresses.length === 0 ? (
          <EmptyState onCreate={() => setIsCreateOpen(true)} />
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE9E3] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_120px] gap-3 px-5 py-3 border-b border-[#EDE9E3]/60 bg-[#FDFBF8]">
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Label
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Address
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Created
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider text-right">
                Actions
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {addresses.map(item => (
                <Row
                  key={item.id}
                  item={item}
                  copied={copiedId === item.id}
                  onCopy={() => handleCopy(item)}
                  onShare={() =>
                    navigate({ to: '/portal/virtual-addresses/$id', params: { id: item.id } })
                  }
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Dialogs */}
      <RegisterMasterDialog
        open={isRegisterOpen}
        onOpenChange={setIsRegisterOpen}
        onComplete={() => setIsCreateOpen(true)}
        onSwitchToLookup={() => setIsLookupOpen(true)}
      />
      <LookupMasterDialog open={isLookupOpen} onOpenChange={setIsLookupOpen} />
      <CreateVirtualAddressDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {/* ImportVirtualAddressDialog intentionally unmounted — hidden in UI for now. */}

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm p-6 rounded-2xl text-center" hideClose>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
            Remove this virtual address?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed mb-5">
            We&apos;ll delete the label. The address itself keeps forwarding on-chain — you can
            re-import it later if you remember it.
          </DialogDescription>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Keep
            </Button>
            <Button
              onClick={handleDelete}
              isLoading={isDeleting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
            >
              {!isDeleting && 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function LoadingState(): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mb-3" />
      <p className="text-[14px] text-[#9B9590]">Loading virtual addresses...</p>
    </div>
  );
}

function UnregisteredState({
  isPending,
  isRecovering,
  onRegister,
  onLookup,
  onRecover,
}: {
  isPending: boolean;
  isRecovering: boolean;
  onRegister: () => void;
  onLookup: () => void;
  onRecover: () => void;
}): ReactElement {
  if (isPending) {
    return (
      <div className="rounded-2xl border border-dashed border-[#9B72CF]/30 bg-[#9B72CF]/5 p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#9B72CF]/15 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-[#9B72CF]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#2D3436]">Setup is half-done</h3>
        <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
          You started master ID setup earlier — we saved your progress. Resume to sign the
          on-chain transaction (no re-preparation needed).
        </p>
        <Button
          onClick={onRegister}
          className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white gap-2"
        >
          Resume setup
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
        <ShieldCheck className="w-7 h-7 text-[#B5B0AA]" />
      </div>
      <h3 className="text-[16px] font-semibold text-[#2D3436]">Get started with virtual addresses</h3>
      <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
        Set up your wallet to hand out unlimited deposit addresses that all forward to you. If
        you&apos;ve already set up elsewhere, link your existing masterId.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Button
          onClick={onRegister}
          className="h-10 px-6 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Create
        </Button>
        <Button
          variant="outline"
          onClick={onLookup}
          className="h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] gap-2"
        >
          <LinkIcon className="w-4 h-4" />
          Link existing
        </Button>
      </div>
      <button
        type="button"
        onClick={onRecover}
        disabled={isRecovering}
        className="mt-4 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#9B9590] hover:text-[#6B6560] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRecovering ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Searching the last 10 days…
          </>
        ) : (
          <>Forgot your master ID? Recover it</>
        )}
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
        <Inbox className="w-7 h-7 text-[#B5B0AA]" />
      </div>
      <h3 className="text-[16px] font-semibold text-[#2D3436]">No virtual addresses yet</h3>
      <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
        Generate one per contact, invoice, or campaign — deposits funnel back to your main wallet
        with zero sweep transactions.
      </p>
      <div className="mt-5 flex items-center justify-center">
        <Button
          onClick={onCreate}
          className="h-10 px-6 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Create your first
        </Button>
      </div>
    </div>
  );
}

function MasterIdBadge({ masterId }: { masterId: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(masterId);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title="Your TIP-1022 master ID — every virtual address you create starts with these 4 bytes"
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#F5F2ED]/80 hover:bg-[#F5F2ED] px-2.5 py-1 transition-colors group"
    >
      <span className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-wider">
        Master ID
      </span>
      <span className="font-mono text-[11px] text-[#2D3436]">{masterId}</span>
      {copied ? (
        <Check className="w-3 h-3 text-[#6B8F71]" />
      ) : (
        <Copy className="w-3 h-3 text-[#B5B0AA] group-hover:text-[#9B9590] transition-colors" />
      )}
    </button>
  );
}

interface RowProps {
  item: VirtualAddress;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function Row({ item, copied, onCopy, onShare, onDelete }: RowProps): ReactElement {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_120px] gap-3 px-5 py-3.5 items-center border-b border-[#EDE9E3]/40 last:border-b-0 hover:bg-[#FDFBF8] transition-colors"
    >
      <Link
        to="/portal/virtual-addresses/$id"
        params={{ id: item.id }}
        className="text-[14px] font-medium text-[#2D3436] truncate hover:text-[#E07A5F] transition-colors"
      >
        {item.label}
      </Link>

      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onCopy}
          title={copied ? 'Copied' : 'Copy address'}
          className="flex items-center gap-1.5 min-w-0 text-left group"
        >
          <span className="font-mono text-[12px] text-[#6B6560] truncate group-hover:text-[#2D3436] transition-colors">
            {formatAddress(item.address)}
          </span>
          {copied ? (
            <Check className="w-3 h-3 text-[#6B8F71] shrink-0" />
          ) : (
            <Copy className="w-3 h-3 text-[#B5B0AA] group-hover:text-[#9B9590] shrink-0 transition-colors" />
          )}
        </button>
        <a
          href={getExplorerAddressUrl(item.address)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Open in explorer"
          className="inline-flex items-center justify-center text-[#B5B0AA] hover:text-[#6B6560] transition-colors shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <span className="text-[13px] text-[#9B9590]">{formatDate(item.createdAt)}</span>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onShare}
          title="Share"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#9B9590] hover:bg-[#F5F2ED] hover:text-[#6B6560] transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Remove"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#9B9590] hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
