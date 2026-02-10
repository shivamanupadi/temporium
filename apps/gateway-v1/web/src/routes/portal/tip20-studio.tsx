import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  Plus,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { formatAmount, formatAddress, copyToClipboard, isValidAddress } from '@/lib/utils';
import { getExplorerTokenUrl, getExplorerTxUrl, getTokenBalance } from '@/lib/tempo-client';
import { CURRENCIES, TIMING } from '@/lib/constants';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import type { Tip20Contract } from '@/types';
import type { Address } from 'viem';

export const Route = createFileRoute('/portal/tip20-studio')({
  component: Tip20StudioPage,
});

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
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabId = 'create' | 'import' | 'tokens';

const TABS: { id: TabId; label: string; icon: typeof Plus }[] = [
  { id: 'create', label: 'Create Token', icon: Plus },
  { id: 'import', label: 'Import Token', icon: Download },
  { id: 'tokens', label: 'My Tokens', icon: Coins },
];

// ---------------------------------------------------------------------------
// Token Balance Display (fetches balance for a single token card)
// ---------------------------------------------------------------------------

function TokenBalanceDisplay({ token, account }: { token: Address; account?: Address }): ReactElement {
  const { data, isLoading } = useTokenBalance(token, account);

  if (isLoading) {
    return (
      <span className="text-[12px] text-[#9B9590] flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading...
      </span>
    );
  }

  return (
    <span className="text-[14px] font-semibold text-[#2D3436] tabular-nums">
      {formatAmount(data.value, 6, 2)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function Tip20StudioPage(): ReactElement {
  const { address, createToken } = useTempo();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('tokens');

  // Tokens list
  const [tokens, setTokens] = useState<Tip20Contract[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);

  // Create Token form
  const [createName, setCreateName] = useState('');
  const [createSymbol, setCreateSymbol] = useState('');
  const [createCurrency, setCreateCurrency] = useState('USD');
  const [createAdmin, setCreateAdmin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createTxHash, setCreateTxHash] = useState<string | null>(null);

  // Import Token form
  const [importAddress, setImportAddress] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    address: Address;
    balance: bigint;
  } | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Tip20Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Success dialog
  const [showSuccess, setShowSuccess] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch tokens
  // ---------------------------------------------------------------------------

  const fetchTokens = useCallback(async () => {
    try {
      const data = await apiGet<Tip20Contract[]>('/v1/tip20-contracts');
      setTokens(data);
    } catch (err) {
      console.error('Failed to fetch TIP20 contracts:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // ---------------------------------------------------------------------------
  // Copy address helper
  // ---------------------------------------------------------------------------

  const handleCopyAddress = useCallback(
    async (addr: string, id: string) => {
      const success = await copyToClipboard(addr);
      if (success) {
        setCopiedId(id);
        toast.success('Address copied');
        setTimeout(() => setCopiedId(null), TIMING.COPY_FEEDBACK_MS);
      } else {
        toast.error('Failed to copy address');
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Create token
  // ---------------------------------------------------------------------------

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) {
      toast.error('Token name is required');
      return;
    }
    if (!createSymbol.trim()) {
      toast.error('Token symbol is required');
      return;
    }
    if (createAdmin && !isValidAddress(createAdmin)) {
      toast.error('Invalid admin address');
      return;
    }

    setIsCreating(true);
    setCreateTxHash(null);

    try {
      const txHash = await createToken({
        name: createName.trim(),
        symbol: createSymbol.trim().toUpperCase(),
        currency: createCurrency,
        admin: createAdmin ? (createAdmin as Address) : undefined,
      });

      setCreateTxHash(txHash);

      // Store in API
      await apiPost<Tip20Contract>('/v1/tip20-contracts', {
        address: txHash,
        name: createName.trim(),
        symbol: createSymbol.trim().toUpperCase(),
        currency: createCurrency,
      });

      // Refresh the list
      await fetchTokens();

      // Show success
      setShowSuccess(true);
      toast.success('Token created successfully');

      // Reset form
      setCreateName('');
      setCreateSymbol('');
      setCreateCurrency('USD');
      setCreateAdmin('');
    } catch (err) {
      toast.error('Token creation failed', {
        description: (err as Error).message,
      });
    } finally {
      setIsCreating(false);
    }
  }, [createName, createSymbol, createCurrency, createAdmin, createToken, fetchTokens]);

  // ---------------------------------------------------------------------------
  // Import token - preview
  // ---------------------------------------------------------------------------

  const handleFetchPreview = useCallback(async () => {
    if (!isValidAddress(importAddress)) {
      toast.error('Please enter a valid token address');
      return;
    }
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    // Check if already imported
    const exists = tokens.some(
      (t) => t.address.toLowerCase() === importAddress.toLowerCase()
    );
    if (exists) {
      toast.error('Token already in your list');
      return;
    }

    setIsFetchingPreview(true);
    setImportPreview(null);

    try {
      const balance = await getTokenBalance(importAddress as Address, address);
      setImportPreview({
        address: importAddress as Address,
        balance,
      });
    } catch (err) {
      toast.error('Failed to fetch token info', {
        description: (err as Error).message,
      });
    } finally {
      setIsFetchingPreview(false);
    }
  }, [importAddress, address, tokens]);

  // ---------------------------------------------------------------------------
  // Import token - confirm
  // ---------------------------------------------------------------------------

  const handleImport = useCallback(async () => {
    if (!importPreview) return;

    setIsImporting(true);

    try {
      await apiPost<Tip20Contract>('/v1/tip20-contracts', {
        address: importPreview.address,
        name: importPreview.address,
        symbol: 'TIP20',
        currency: 'USD',
      });

      await fetchTokens();
      toast.success('Token imported successfully');

      // Reset
      setImportAddress('');
      setImportPreview(null);
      setActiveTab('tokens');
    } catch (err) {
      toast.error('Failed to import token', {
        description: (err as Error).message,
      });
    } finally {
      setIsImporting(false);
    }
  }, [importPreview, fetchTokens]);

  // ---------------------------------------------------------------------------
  // Delete token
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    try {
      await apiDelete(`/v1/tip20-contracts/${deleteTarget.id}`);
      setTokens((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success('Token removed from list');
    } catch (err) {
      toast.error('Failed to remove token', {
        description: (err as Error).message,
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#5B9A6F]/10 flex items-center justify-center">
            <Coins className="w-5 h-5 text-[#5B9A6F]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">TIP20 Studio</h1>
            <p className="text-[14px] text-[#6B6560]">
              Create, import, and manage your stablecoins.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab Bar */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-1 p-1 rounded-xl bg-[#F5F2ED] border border-[#EDE9E3]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  text-[13px] font-semibold transition-all duration-200 cursor-pointer
                  ${isActive
                    ? 'bg-white text-[#2D3436] shadow-sm'
                    : 'text-[#9B9590] hover:text-[#6B6560]'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'tokens' && tokens.length > 0 && (
                  <span
                    className={`
                      ml-1 text-[11px] font-bold min-w-[20px] h-5 flex items-center justify-center
                      rounded-full px-1.5
                      ${isActive ? 'bg-[#5B9A6F]/10 text-[#5B9A6F]' : 'bg-[#EDE9E3] text-[#9B9590]'}
                    `}
                  >
                    {tokens.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'create' && (
          <motion.div
            key="create"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <CreateTokenTab
              name={createName}
              symbol={createSymbol}
              currency={createCurrency}
              admin={createAdmin}
              isCreating={isCreating}
              onNameChange={setCreateName}
              onSymbolChange={setCreateSymbol}
              onCurrencyChange={setCreateCurrency}
              onAdminChange={setCreateAdmin}
              onCreate={handleCreate}
            />
          </motion.div>
        )}

        {activeTab === 'import' && (
          <motion.div
            key="import"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <ImportTokenTab
              importAddress={importAddress}
              onAddressChange={setImportAddress}
              onFetchPreview={handleFetchPreview}
              isFetchingPreview={isFetchingPreview}
              preview={importPreview}
              isImporting={isImporting}
              onImport={handleImport}
              onClearPreview={() => setImportPreview(null)}
            />
          </motion.div>
        )}

        {activeTab === 'tokens' && (
          <motion.div
            key="tokens"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <MyTokensTab
              tokens={tokens}
              isLoading={isLoadingTokens}
              copiedId={copiedId}
              address={address}
              onCopy={handleCopyAddress}
              onDelete={setDeleteTarget}
              onCreateNew={() => setActiveTab('create')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="p-6">
          <DialogTitle className="text-[16px] font-semibold text-[#2D3436]">
            Remove Token
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] mt-2">
            Remove <span className="font-semibold text-[#2D3436]">{deleteTarget?.name}</span>{' '}
            ({deleteTarget?.symbol}) from your list? This does not affect the on-chain contract.
          </DialogDescription>
          <div className="flex gap-2.5 mt-5">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 h-10 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#2D3436] hover:bg-[#F5F2ED]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Remove
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#5B9A6F]/10 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-[#5B9A6F]" />
            </div>
          </div>
          <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
            Token Created
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] mt-2">
            Your TIP20 stablecoin has been deployed to the Tempo network.
          </DialogDescription>
          {createTxHash && (
            <a
              href={getExplorerTxUrl(createTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5B9A6F] hover:text-[#4E8A62] mt-3 transition-colors"
            >
              View Transaction
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div className="mt-5">
            <Button
              onClick={() => {
                setShowSuccess(false);
                setActiveTab('tokens');
              }}
              className="w-full h-10 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
            >
              View My Tokens
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Create Token Tab
// ---------------------------------------------------------------------------

interface CreateTokenTabProps {
  name: string;
  symbol: string;
  currency: string;
  admin: string;
  isCreating: boolean;
  onNameChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onAdminChange: (v: string) => void;
  onCreate: () => void;
}

function CreateTokenTab({
  name,
  symbol,
  currency,
  admin,
  isCreating,
  onNameChange,
  onSymbolChange,
  onCurrencyChange,
  onAdminChange,
  onCreate,
}: CreateTokenTabProps): ReactElement {
  return (
    <div className="rounded-2xl border border-[#EDE9E3] bg-white p-6 space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold text-[#2D3436] mb-1">Create a New Token</h2>
        <p className="text-[13px] text-[#9B9590]">
          Deploy a TIP20 stablecoin on the Tempo network.
        </p>
      </div>

      {/* Token Name */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Token Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Acme Dollar"
          disabled={isCreating}
          className="w-full h-11 px-4 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:outline-none focus:ring-2 focus:ring-[#5B9A6F]/30 focus:border-[#5B9A6F] transition-all disabled:opacity-50"
        />
      </div>

      {/* Token Symbol */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Token Symbol
        </label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          placeholder="e.g. ACME"
          maxLength={10}
          disabled={isCreating}
          className="w-full h-11 px-4 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono uppercase placeholder:text-[#B5B0AA] placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#5B9A6F]/30 focus:border-[#5B9A6F] transition-all disabled:opacity-50"
        />
      </div>

      {/* Currency */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Backed Currency
        </label>
        <div className="relative">
          <select
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            disabled={isCreating}
            className="w-full h-11 px-4 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B9A6F]/30 focus:border-[#5B9A6F] transition-all disabled:opacity-50 cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-[#9B9590]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Admin Address (optional) */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Admin Address
          <span className="text-[#B5B0AA] font-normal ml-1.5">(optional)</span>
        </label>
        <input
          type="text"
          value={admin}
          onChange={(e) => onAdminChange(e.target.value)}
          placeholder="0x..."
          disabled={isCreating}
          className="w-full h-11 px-4 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#5B9A6F]/30 focus:border-[#5B9A6F] transition-all disabled:opacity-50"
        />
        <p className="text-[11px] text-[#B5B0AA] mt-1.5">
          If left empty, your connected wallet will be the admin.
        </p>
      </div>

      {/* Submit */}
      <Button
        onClick={onCreate}
        disabled={isCreating || !name.trim() || !symbol.trim()}
        className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Deploying Token...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Create Token
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Token Tab
// ---------------------------------------------------------------------------

interface ImportTokenTabProps {
  importAddress: string;
  onAddressChange: (v: string) => void;
  onFetchPreview: () => void;
  isFetchingPreview: boolean;
  preview: { address: Address; balance: bigint } | null;
  isImporting: boolean;
  onImport: () => void;
  onClearPreview: () => void;
}

function ImportTokenTab({
  importAddress,
  onAddressChange,
  onFetchPreview,
  isFetchingPreview,
  preview,
  isImporting,
  onImport,
  onClearPreview,
}: ImportTokenTabProps): ReactElement {
  return (
    <div className="rounded-2xl border border-[#EDE9E3] bg-white p-6 space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold text-[#2D3436] mb-1">Import a Token</h2>
        <p className="text-[13px] text-[#9B9590]">
          Add an existing TIP20 token to your tracked list by entering its contract address.
        </p>
      </div>

      {/* Token Address Input */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Token Address
        </label>
        <div className="flex gap-2.5">
          <input
            type="text"
            value={importAddress}
            onChange={(e) => {
              onAddressChange(e.target.value);
              onClearPreview();
            }}
            placeholder="0x..."
            disabled={isFetchingPreview || isImporting}
            className="flex-1 h-11 px-4 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#5B9A6F]/30 focus:border-[#5B9A6F] transition-all disabled:opacity-50"
          />
          <Button
            onClick={onFetchPreview}
            disabled={isFetchingPreview || !isValidAddress(importAddress)}
            className="h-11 px-5 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#1a2021] text-white"
          >
            {isFetchingPreview ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Preview Card */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[#5B9A6F]/20 bg-[#5B9A6F]/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Token Found
              </span>
              <CheckCircle className="w-4 h-4 text-[#5B9A6F]" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Address</span>
                <span className="text-[13px] font-mono text-[#2D3436]">
                  {formatAddress(preview.address, 6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Your Balance</span>
                <span className="text-[13px] font-semibold text-[#2D3436] tabular-nums">
                  {formatAmount(preview.balance, 6, 2)}
                </span>
              </div>
            </div>

            <Button
              onClick={onImport}
              disabled={isImporting}
              className="w-full h-10 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1.5" />
                  Add to My Tokens
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Tokens Tab
// ---------------------------------------------------------------------------

interface MyTokensTabProps {
  tokens: Tip20Contract[];
  isLoading: boolean;
  copiedId: string | null;
  address?: Address;
  onCopy: (addr: string, id: string) => void;
  onDelete: (token: Tip20Contract) => void;
  onCreateNew: () => void;
}

function MyTokensTab({
  tokens,
  isLoading,
  copiedId,
  address,
  onCopy,
  onDelete,
  onCreateNew,
}: MyTokensTabProps): ReactElement {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#EDE9E3] bg-white p-12 flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mb-3" />
        <p className="text-[14px] text-[#9B9590]">Loading tokens...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-[#FDFBF8] p-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#5B9A6F]/10 flex items-center justify-center mb-4">
          <Coins className="w-7 h-7 text-[#5B9A6F]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#2D3436] mb-1">No Tokens Yet</h3>
        <p className="text-[13px] text-[#9B9590] mb-5 max-w-xs">
          Create a new TIP20 stablecoin or import an existing token to get started.
        </p>
        <Button
          onClick={onCreateNew}
          className="h-10 px-6 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Your First Token
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {tokens.map((token) => (
          <motion.div
            key={token.id}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            className="rounded-2xl border border-[#EDE9E3] bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Token Info */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl bg-[#5B9A6F]/10 flex items-center justify-center shrink-0">
                  <span className="text-[14px] font-bold text-[#5B9A6F]">
                    {token.symbol.slice(0, 2)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-[#2D3436] truncate">
                      {token.name}
                    </p>
                    <span className="text-[11px] font-semibold text-[#5B9A6F] bg-[#5B9A6F]/10 px-2 py-0.5 rounded-md shrink-0">
                      {token.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => onCopy(token.address, token.id)}
                      className="inline-flex items-center gap-1 text-[12px] font-mono text-[#9B9590] hover:text-[#6B6560] transition-colors cursor-pointer"
                    >
                      {formatAddress(token.address, 6)}
                      {copiedId === token.id ? (
                        <Check className="w-3 h-3 text-[#5B9A6F]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <span className="text-[11px] text-[#B5B0AA]">{token.currency}</span>
                  </div>
                </div>
              </div>

              {/* Balance & Actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <TokenBalanceDisplay token={token.address} account={address} />
                <div className="flex items-center gap-1">
                  <a
                    href={getExplorerTokenUrl(token.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9B9590] hover:text-[#2D3436] hover:bg-[#F5F2ED] transition-colors"
                    title="View in explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => onDelete(token)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9B9590] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove token"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
