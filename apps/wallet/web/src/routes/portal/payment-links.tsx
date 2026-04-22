import {
  type ReactElement,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Plus,
  Copy,
  Check,
  Loader2,
  Trash2,
  ExternalLink,
  X,
  Calendar,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useTokenList } from '@/hooks/useTokenList';
import { useTempo } from '@/hooks/useTempo';
import {
  listPaymentLinks,
  createPaymentLink,
  cancelPaymentLink,
  getPaymentLink,
  getPaymentLinksConfig,
  type PaymentLink,
  type PaymentLinkListItem,
  type PaymentLinkDetail,
  type PaymentLinksConfig,
} from '@/lib/payment-links-api';
import type { Token } from '@/lib/tokenlist';
import { getTokenColors } from '@/lib/tokenlist';
import {
  formatAddress,
  formatAmount,
  formatFeePct,
  computeFeeBreakdown,
  copyToClipboard,
  cn,
} from '@/lib/utils';
import { TIMING, LINKS } from '@/lib/constants';

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

type PaymentLinksFilter = 'all' | 'active' | 'completed' | 'cancelled' | 'expired';

const FILTERS: ReadonlyArray<{ key: PaymentLinksFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'expired', label: 'Expired' },
];

function isFilter(value: unknown): value is PaymentLinksFilter {
  return (
    value === 'all' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'cancelled' ||
    value === 'expired'
  );
}

interface PaymentLinksSearch {
  filter?: PaymentLinksFilter;
}

export const Route = createFileRoute('/portal/payment-links')({
  component: PaymentLinksPage,
  validateSearch: (search: Record<string, unknown>): PaymentLinksSearch => ({
    filter: isFilter(search.filter) ? search.filter : undefined,
  }),
});

// -----------------------------------------------------------------------------
// Animation presets
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
// Helpers
// -----------------------------------------------------------------------------

const PAGE_SIZE = 20;

/**
 * Map the client-side filter to the backend status query param.
 * Every filter maps 1:1 to a native server status (or `undefined` for All),
 * so filtering is fully server-side - pagination always returns a full page.
 */
function filterToBackendStatus(
  filter: PaymentLinksFilter
): 'active' | 'completed' | 'cancelled' | 'expired' | undefined {
  return filter === 'all' ? undefined : filter;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildShareUrl(id: string): string {
  if (typeof window === 'undefined') return `/pay/${id}`;
  return `${window.location.origin}/pay/${id}`;
}

/**
 * Token logo URL for the Tempo tokenlist - keyed on chainId + lowercased
 * token address. Reconstructed client-side so we don't need an extra round
 * trip to the tokenlist API just to render a small icon.
 */
const NETWORK_CHAIN_ID: Record<'testnet' | 'mainnet', number> = {
  testnet: 42431,
  mainnet: 4217,
};

function getTokenLogoURI(network: 'testnet' | 'mainnet', tokenAddress: string): string {
  return `https://esm.sh/gh/tempoxyz/tempo-apps/apps/tokenlist/data/${NETWORK_CHAIN_ID[network]}/icons/${tokenAddress.toLowerCase()}.svg`;
}

/**
 * Small token icon: a colored circle (from `getTokenColors`) with the
 * logo image inside, falling back to a typographic `$` glyph if the image
 * fails to load.
 */
function TokenIcon({
  symbol,
  address,
  network,
  size = 20,
}: {
  symbol: string;
  address: string;
  network: 'testnet' | 'mainnet';
  size?: number;
}): ReactElement {
  const colors = getTokenColors(symbol);
  const [errored, setErrored] = useState(false);
  const src = getTokenLogoURI(network, address);

  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 align-middle"
      style={{ width: size, height: size, backgroundColor: colors.bg }}
    >
      {!errored ? (
        <img
          src={src}
          alt={symbol}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span
          style={{
            fontSize: Math.max(10, size * 0.55),
            fontWeight: 600,
            color: colors.text,
            lineHeight: 1,
          }}
        >
          $
        </span>
      )}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------

function PaymentLinksPage(): ReactElement {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeFilter: PaymentLinksFilter = search?.filter ?? 'all';

  const [links, setLinks] = useState<PaymentLinkListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [config, setConfig] = useState<PaymentLinksConfig | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PaymentLinkListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentLinkListItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFilter = useCallback(
    (next: PaymentLinksFilter) => {
      navigate({
        to: '/portal/payment-links',
        search: { filter: next === 'all' ? undefined : next },
        replace: true,
      } as never);
    },
    [navigate]
  );

  /**
   * Fetches a page of links for the current filter. When `cursor` is
   * supplied the result is appended (for Load More); without a cursor it
   * replaces the list (initial load / refresh / filter change).
   */
  const fetchLinks = useCallback(
    async (cursor?: string): Promise<void> => {
      try {
        const data = await listPaymentLinks({
          status: filterToBackendStatus(activeFilter),
          cursor,
          limit: PAGE_SIZE,
        });
        if (cursor) {
          setLinks(prev => [...prev, ...data.items]);
        } else {
          setLinks(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (err) {
        toast.error('Failed to load payment links', {
          description: (err as Error).message,
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeFilter]
  );

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await fetchLinks();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchLinks]);

  const handleLoadMore = useCallback((): void => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    void fetchLinks(nextCursor);
  }, [nextCursor, isLoadingMore, fetchLinks]);

  // (Re-)load on mount and whenever the filter changes.
  useEffect(() => {
    setIsLoading(true);
    setLinks([]);
    setNextCursor(null);
    void fetchLinks();
  }, [fetchLinks]);

  // Fee config is loaded once.
  useEffect(() => {
    void getPaymentLinksConfig()
      .then(setConfig)
      .catch(() => {
        /* non-fatal: fee panel just hides */
      });
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyLink = useCallback(async (link: PaymentLink): Promise<void> => {
    const url = buildShareUrl(link.id);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(link.id);
      toast.success('Link copied', { description: url });
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), TIMING.COPY_FEEDBACK_MS);
    } else {
      toast.error('Failed to copy link');
    }
  }, []);

  const handleCreated = useCallback((created: PaymentLink) => {
    // Insert into list at the top as a list item (paymentCount = 0 for new).
    setLinks(prev => [{ ...created, paymentCount: 0 }, ...prev]);
    setIsCreateOpen(false);
  }, []);

  const handleCancel = useCallback(async (): Promise<void> => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelPaymentLink(cancelTarget.id);
      setLinks(prev =>
        prev.map(l => (l.id === cancelTarget.id ? { ...l, status: 'cancelled' } : l))
      );
      toast.success('Payment link cancelled');
      setCancelTarget(null);
    } catch (err) {
      toast.error('Failed to cancel', { description: (err as Error).message });
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget]);

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
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Payment Links</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Create a shareable link to accept payments to your wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Link
          </Button>
        </div>
      </motion.div>

      {/* Filter tabs - no motion wrapper: it mounts after the parent's
          stagger has completed, and child variants inherit the parent's
          current state, which leaves the new child stuck at opacity 0. */}
      {!isLoading && <FilterTabs active={activeFilter} onChange={setFilter} />}

      {/* List */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mb-3" />
            <p className="text-[14px] text-[#9B9590]">Loading payment links...</p>
          </div>
        ) : links.length === 0 ? (
          activeFilter === 'all' ? (
            <EmptyState onCreate={() => setIsCreateOpen(true)} />
          ) : (
            <FilteredEmptyState filter={activeFilter} onClear={() => setFilter('all')} />
          )
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE9E3] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[minmax(0,1.6fr)_140px_110px_110px_110px_120px] gap-3 px-5 py-3 border-b border-[#EDE9E3]/60 bg-[#FDFBF8]">
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Title
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Amount
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Mode
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Status
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                Created
              </span>
              <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider text-right">
                Actions
              </span>
            </div>

            {/* Body */}
            <AnimatePresence mode="popLayout">
              {links.map((link, index) => (
                <PaymentLinkRow
                  key={link.id}
                  link={link}
                  isLast={index === links.length - 1}
                  copied={copiedId === link.id}
                  onCopy={() => handleCopyLink(link)}
                  onOpen={() => setDetailTarget(link)}
                  onCancel={() => setCancelTarget(link)}
                />
              ))}
            </AnimatePresence>

            {nextCursor && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="w-full px-5 py-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#9B9590] hover:text-[#6B6560] hover:bg-[#FDFBF8] transition-colors border-t border-[#EDE9E3]/40 disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load more</>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Create dialog */}
      <CreateLinkDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        feeBps={config?.feeBps ?? 0}
        onCreated={handleCreated}
      />

      {/* Detail sidebar */}
      <DetailSidebar link={detailTarget} onClose={() => setDetailTarget(null)} />

      {/* Cancel confirmation */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={open => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent className="max-w-sm p-6 rounded-2xl text-center" hideClose>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
            Cancel payment link?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed mb-5">
            The link will stop accepting new payments. Any payments already received will be
            preserved in your history.
          </DialogDescription>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Keep
            </Button>
            <Button
              onClick={handleCancel}
              isLoading={isCancelling}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
            >
              {!isCancelling && 'Cancel Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Empty state
// -----------------------------------------------------------------------------

function EmptyState({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
        <Link2 className="w-7 h-7 text-[#B5B0AA]" />
      </div>
      <h3 className="text-[16px] font-semibold text-[#2D3436]">No payment links yet</h3>
      <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
        Create a link once, share it anywhere, and we&apos;ll record payments as they come in.
      </p>
      <Button
        onClick={onCreate}
        variant="outline"
        className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
      >
        <Plus className="w-4 h-4" />
        Create a Payment Link
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Filter tabs + filtered empty state
// -----------------------------------------------------------------------------

interface FilterTabsProps {
  active: PaymentLinksFilter;
  onChange: (next: PaymentLinksFilter) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps): ReactElement {
  return (
    <div className="flex gap-1 p-1 bg-[#F5F2ED] rounded-lg shrink-0">
      {FILTERS.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
            active === f.key
              ? 'bg-white text-[#2D3436] shadow-sm'
              : 'text-[#9B9590] hover:text-[#6B6560]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function FilteredEmptyState({
  filter,
  onClear,
}: {
  filter: PaymentLinksFilter;
  onClear: () => void;
}): ReactElement {
  const label = FILTERS.find(f => f.key === filter)?.label.toLowerCase() ?? 'matching';
  return (
    <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3.5">
        <Link2 className="w-6 h-6 text-[#B5B0AA]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#2D3436]">No {label} links</h3>
      <p className="text-[12.5px] text-[#9B9590] mt-1 max-w-xs mx-auto leading-relaxed">
        Nothing matches this filter right now.
      </p>
      <Button
        onClick={onClear}
        variant="outline"
        className="mt-4 h-9 px-4 rounded-xl text-[12.5px] font-semibold border-[#EDE9E3]"
      >
        Clear filter
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Link row
// -----------------------------------------------------------------------------

interface LinkRowProps {
  link: PaymentLinkListItem;
  isLast: boolean;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
  onCancel: () => void;
}

/**
 * A single row in the payment-links data table. Click anywhere (except the
 * action icons) to open the details sidebar.
 */
function PaymentLinkRow({
  link,
  isLast,
  copied,
  onCopy,
  onOpen,
  onCancel,
}: LinkRowProps): ReactElement {
  let statusLabel: string;
  let statusClass: string;
  if (link.status === 'completed') {
    statusLabel = link.paymentCount > 1 ? `${link.paymentCount} paid` : 'Paid';
    statusClass = 'bg-[#6B8F71]/10 text-[#6B8F71]';
  } else if (link.status === 'cancelled') {
    statusLabel = 'Cancelled';
    statusClass = 'bg-[#F5F2ED] text-[#9B9590]';
  } else if (link.status === 'expired') {
    statusLabel = 'Expired';
    statusClass = 'bg-[#F5F2ED] text-[#9B9590]';
  } else if (link.reusable && link.paymentCount > 0) {
    statusLabel = `${link.paymentCount} paid`;
    statusClass = 'bg-[#6B8F71]/10 text-[#6B8F71]';
  } else {
    statusLabel = 'Pending';
    statusClass = 'bg-[#D4A574]/15 text-[#B3862E]';
  }

  const modeLabel = link.reusable ? 'Reusable' : 'Single-use';

  /** Prevent row click when interacting with an action icon. */
  const stop = (e: React.MouseEvent): void => {
    e.stopPropagation();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      className={cn(
        'grid grid-cols-[minmax(0,1.6fr)_140px_110px_110px_110px_120px] gap-3 px-5 py-3.5 items-center hover:bg-[#FDFBF8] transition-colors cursor-pointer',
        !isLast && 'border-b border-[#EDE9E3]/40'
      )}
    >
      {/* Title + description */}
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-[#2D3436] truncate">
          {link.title ?? 'Untitled link'}
        </p>
        {link.description && (
          <p className="text-[11.5px] text-[#9B9590] truncate mt-0.5">{link.description}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex items-center gap-2 min-w-0">
        <TokenIcon
          symbol={link.tokenSymbol}
          address={link.token}
          network={link.network}
          size={20}
        />
        <div className="min-w-0 flex items-baseline gap-1">
          <span className="text-[13px] font-mono font-semibold text-[#2D3436] truncate">
            {link.amountDecimal}
          </span>
          <span className="text-[11px] text-[#9B9590] truncate">{link.tokenSymbol}</span>
        </div>
      </div>

      {/* Mode */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F2ED] text-[#6B6560] w-fit">
        {modeLabel}
      </span>

      {/* Status */}
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit',
          statusClass
        )}
      >
        {statusLabel}
      </span>

      {/* Created */}
      <span className="text-[12px] text-[#9B9590]">{formatDate(link.createdAt)}</span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 shrink-0">
        <button
          type="button"
          onClick={e => {
            stop(e);
            onCopy();
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-[#E07A5F] hover:bg-[#E07A5F]/[0.06] transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-[#6B8F71]" /> : <Copy className="w-4 h-4" />}
        </button>
        <a
          href={`/pay/${link.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-[#E07A5F] hover:bg-[#E07A5F]/[0.06] transition-colors"
          title="Open public link"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        {link.status === 'active' && link.paymentCount === 0 && (
          <button
            type="button"
            onClick={e => {
              stop(e);
              onCancel();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Cancel link"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Create dialog
// -----------------------------------------------------------------------------

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feeBps: number;
  onCreated: (link: PaymentLink) => void;
}

function CreateLinkDialog({
  open,
  onOpenChange,
  feeBps,
  onCreated,
}: CreateDialogProps): ReactElement {
  const { address } = useTempo();

  // Use the curated official tokenlist only - custom user-added tokens are
  // excluded from the picker so the backend resolver always succeeds.
  const { officialTokens, isLoading: tokensLoading } = useTokenList();
  const pickerTokens = officialTokens;

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reusable, setReusable] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Once the token list resolves, default to the first allowed entry.
  useEffect(() => {
    if (!selectedToken && pickerTokens.length > 0) {
      setSelectedToken(pickerTokens[0]);
    }
  }, [pickerTokens, selectedToken]);

  const resetForm = useCallback((): void => {
    setRecipient('');
    setAmount('');
    setTitle('');
    setDescription('');
    setReusable(false);
    setExpiresAt(undefined);
    setSelectedToken(pickerTokens[0] ?? null);
  }, [pickerTokens]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!recipient.trim() || !/^0x[a-fA-F0-9]{40}$/.test(recipient.trim())) {
      toast.error('Enter a valid recipient address');
      return;
    }
    if (!selectedToken) {
      toast.error('Pick a currency first');
      return;
    }
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed) || parseFloat(trimmed) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Enter a title');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createPaymentLink({
        token: selectedToken.address,
        amount: trimmed,
        recipient: recipient.trim(),
        title: trimmedTitle,
        description: description.trim() || undefined,
        reusable,
        expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      });
      toast.success('Payment link created', {
        description: 'Share the link to receive payment.',
      });
      resetForm();
      onCreated(created);
    } catch (err) {
      toast.error('Failed to create payment link', { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedToken,
    recipient,
    amount,
    title,
    description,
    reusable,
    expiresAt,
    onCreated,
    resetForm,
  ]);

  // Fee breakdown (only shown when feeBps > 0).
  const feeBreakdown = useMemo(
    () => (selectedToken ? computeFeeBreakdown(amount, feeBps, selectedToken.decimals) : null),
    [feeBps, amount, selectedToken]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 rounded-2xl">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-bold text-[#2D3436]">New Payment Link</DialogTitle>
          <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
            Create a payment link for yourself or an external address.
          </DialogDescription>
        </div>
        <div className="border-t border-[#EDE9E3]/60" />

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Recipient */}
          <ContactPicker value={recipient} onChange={setRecipient} selfAddress={address} />

          {/* Amount + Token */}
          <div>
            <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
              Amount
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-[16px] font-semibold h-11 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:border-coral focus:ring-1 focus:ring-coral/20 flex-1"
              />
              {tokensLoading || !selectedToken ? (
                <div className="h-11 w-[130px] rounded-xl bg-[#F5F2ED] flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#B5B0AA]" />
                </div>
              ) : (
                <TokenPicker
                  token={selectedToken}
                  tokens={pickerTokens}
                  onChange={setSelectedToken}
                />
              )}
            </div>
          </div>

          {/* Fee breakdown */}
          {feeBreakdown && selectedToken && (
            <div className="rounded-xl bg-[#F5F2ED] p-3.5 text-[11px] text-[#6B6560] space-y-1">
              <div className="flex items-center justify-between">
                <span>Gross</span>
                <span className="font-mono">
                  {feeBreakdown.gross} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Platform fee ({feeBreakdown.pct})</span>
                <span className="font-mono">
                  −{feeBreakdown.fee} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#EDE9E3]">
                <span className="font-semibold text-[#2D3436]">Recipient receives</span>
                <span className="font-mono font-semibold text-[#2D3436]">
                  {feeBreakdown.net} {selectedToken.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Mode */}
          <div>
            <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
              Mode
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReusable(false)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all',
                  reusable
                    ? 'border-[#EDE9E3] bg-[#FDFBF8] hover:border-[#D5D0CA]'
                    : 'border-[#E07A5F]/30 bg-[#E07A5F]/8'
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-semibold',
                    reusable ? 'text-[#2D3436]' : 'text-[#E07A5F]'
                  )}
                >
                  Single-use
                </span>
                <p
                  className={cn(
                    'text-[11px] mt-1 leading-tight',
                    reusable ? 'text-[#9B9590]' : 'text-[#E07A5F]/70'
                  )}
                >
                  Locks after the first payment.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setReusable(true)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all',
                  !reusable
                    ? 'border-[#EDE9E3] bg-[#FDFBF8] hover:border-[#D5D0CA]'
                    : 'border-[#E07A5F]/30 bg-[#E07A5F]/8'
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-semibold',
                    !reusable ? 'text-[#2D3436]' : 'text-[#E07A5F]'
                  )}
                >
                  Reusable
                </span>
                <p
                  className={cn(
                    'text-[11px] mt-1 leading-tight',
                    !reusable ? 'text-[#9B9590]' : 'text-[#E07A5F]/70'
                  )}
                >
                  Accepts unlimited payments.
                </p>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label
              htmlFor="link-title"
              className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block"
            >
              Title <span className="text-[#E07A5F] normal-case">*</span>
            </Label>
            <Input
              id="link-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. March invoice"
              maxLength={80}
              className="h-11 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] text-[14px] focus:border-coral focus:ring-1 focus:ring-coral/20"
            />
          </div>

          {/* Description */}
          <div>
            <Label
              htmlFor="link-description"
              className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block"
            >
              Description{' '}
              <span className="text-[#B5B0AA] normal-case tracking-normal">(optional)</span>
            </Label>
            <textarea
              id="link-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short note shown to the payer"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-[#B5B0AA] outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 resize-none"
            />
          </div>

          {/* Expiration */}
          <div>
            <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
              Expires <span className="text-[#B5B0AA] normal-case tracking-normal">(optional)</span>
            </Label>
            <DateTimePicker
              date={expiresAt}
              onDateChange={setExpiresAt}
              color="coral"
              placeholder="Pick a date & time"
              disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={
              !recipient.trim() || !selectedToken || !amount.trim() || !title.trim() || isSubmitting
            }
            className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
          >
            {!isSubmitting && <Plus className="w-4 h-4 mr-1" />}
            {isSubmitting ? undefined : 'Create Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Detail sidebar - slides in from the right with full link + payments
// -----------------------------------------------------------------------------

function DetailSidebar({
  link,
  onClose,
}: {
  link: PaymentLinkListItem | null;
  onClose: () => void;
}): ReactElement {
  const [detail, setDetail] = useState<PaymentLinkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const isOpen = !!link;

  useEffect(() => {
    if (!link) {
      setDetail(null);
      return;
    }
    setLoading(true);
    void getPaymentLink(link.id)
      .then(setDetail)
      .catch(err => toast.error('Failed to load details', { description: (err as Error).message }))
      .finally(() => setLoading(false));
  }, [link]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const modeLabel = link?.reusable ? 'Reusable' : 'Single-use';
  const shareUrl = link ? buildShareUrl(link.id) : '';

  return (
    <AnimatePresence>
      {isOpen && link && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[#2D3436]/25 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Payment link details"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[#EDE9E3]/60 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Payment link
                </p>
                <h2 className="text-[18px] font-bold text-[#2D3436] mt-1 truncate">
                  {link.title ?? 'Untitled link'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-[#2D3436] hover:bg-[#F5F2ED] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Amount hero */}
              <div className="px-6 py-6 text-center border-b border-[#EDE9E3]/60">
                <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Amount
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <TokenIcon
                    symbol={link.tokenSymbol}
                    address={link.token}
                    network={link.network}
                    size={28}
                  />
                  <p className="font-mono text-[32px] font-bold text-[#2D3436] leading-none tracking-tight">
                    {link.amountDecimal}
                  </p>
                </div>
                <p className="mt-1.5 text-[12px] text-[#6B6560] uppercase tracking-wider">
                  {link.tokenSymbol}
                </p>
                {link.description && (
                  <p className="mt-4 text-[13px] text-[#6B6560] leading-relaxed whitespace-pre-wrap max-w-[360px] mx-auto">
                    {link.description}
                  </p>
                )}
              </div>

              {/* Facts */}
              <div className="px-6 py-5 space-y-3 border-b border-[#EDE9E3]/60">
                <SidebarRow label="Recipient">
                  <span className="font-mono">{formatAddress(link.recipient, 6)}</span>
                </SidebarRow>
                <SidebarRow label="Mode">{modeLabel}</SidebarRow>
                <SidebarRow label="Network">
                  <span className="capitalize">{link.network}</span>
                </SidebarRow>
                <SidebarRow label="Created">
                  {new Date(link.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </SidebarRow>
                {link.expiresAt && (
                  <SidebarRow label="Expires">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#B5B0AA]" />
                      {formatDate(link.expiresAt)}
                    </span>
                  </SidebarRow>
                )}
                <SidebarRow label="Share link">
                  <span className="inline-flex items-center gap-1.5 truncate max-w-[240px]">
                    <span className="truncate font-mono text-[11px] text-[#2D3436]">
                      {shareUrl.replace(/^https?:\/\//, '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void copyToClipboard(shareUrl);
                        toast.success('Link copied');
                      }}
                      className="shrink-0 text-[#B5B0AA] hover:text-[#2D3436] transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[#B5B0AA] hover:text-[#2D3436] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                </SidebarRow>
              </div>

              {/* Payments */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Payments received
                  </h3>
                  {detail && detail.payments.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#6B6560] bg-[#F5F2ED] px-2 py-0.5 rounded-md">
                      {detail.payments.length}
                    </span>
                  )}
                </div>

                {loading || !detail ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-[#B5B0AA]" />
                  </div>
                ) : detail.payments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#EDE9E3] bg-[#FDFBF8] p-8 text-center">
                    <ShieldCheck className="w-9 h-9 text-[#B5B0AA] mx-auto mb-2.5" />
                    <p className="text-[13px] text-[#9B9590]">No payments received yet</p>
                    <p className="text-[11.5px] text-[#B5B0AA] mt-1">
                      Share the link to start receiving payments
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detail.payments.map(p => (
                      <div key={p.id} className="rounded-xl border border-[#EDE9E3] bg-white p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-semibold text-[#2D3436] truncate font-mono">
                                {p.payer ? formatAddress(p.payer, 6) : 'Payment received'}
                              </p>
                              {p.payer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void copyToClipboard(p.payer);
                                    toast.success('Address copied');
                                  }}
                                  className="shrink-0 text-[#B5B0AA] hover:text-[#2D3436] transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {p.payer && (
                                <a
                                  href={`${LINKS.explorer}/address/${p.payer}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-[#B5B0AA] hover:text-[#2D3436] transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-[11px] text-[#9B9590] mt-0.5">
                              {new Date(p.paidAt).toLocaleString()}
                            </p>
                          </div>
                          {p.txHash && (
                            <a
                              href={`${LINKS.explorer}/tx/${p.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[11.5px] text-[#E07A5F] font-medium hover:underline inline-flex items-center gap-1"
                            >
                              View tx <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {/* Per-payment fee breakdown */}
                        <div className="mt-2 pt-2 border-t border-[#F5F2ED] text-[11px] text-[#9B9590] font-mono space-y-0.5">
                          <div className="flex justify-between">
                            <span>Gross</span>
                            <span>
                              {formatAmount(p.amount, detail.tokenDecimals)} {detail.tokenSymbol}
                            </span>
                          </div>
                          {p.feeBps > 0 && (
                            <div className="flex justify-between">
                              <span>Fee ({formatFeePct(p.feeBps)})</span>
                              <span>
                                −{formatAmount(p.feeAmount, detail.tokenDecimals)}{' '}
                                {detail.tokenSymbol}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold text-[#2D3436]">
                            <span>You received</span>
                            <span>
                              {formatAmount(p.netAmount, detail.tokenDecimals)} {detail.tokenSymbol}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** Label/value row used inside the sidebar's facts panel. */
function SidebarRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className="text-[12.5px] text-[#2D3436] font-medium text-right min-w-0">
        {children}
      </span>
    </div>
  );
}
