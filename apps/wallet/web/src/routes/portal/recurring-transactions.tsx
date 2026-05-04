import { type ReactElement, type ReactNode, useState, useMemo, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Repeat,
  Plus,
  Loader2,
  Pause,
  Play,
  XCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  SkipForward,
} from 'lucide-react';
// Clock type used as icon shape in STATUS_STYLE; lint may be confused — keep import
import type { Address, Hex } from 'viem';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { useTempo } from '@/hooks/useTempo';
import { useAccessKeys } from '@/hooks/useAccessKeys';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import {
  useRecurringTransactions,
  type RecurringTransaction,
  type RecurringExecution,
} from '@/hooks/useRecurringTransactions';
import { generateSecp256k1Key } from '@/lib/access-keys-utils';
import { apiGet } from '@/lib/api-client';
import { parseAmount, isValidAddress, formatAmount, formatAddress, cn } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { Token } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/recurring-transactions')({
  component: RecurringPage,
});

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb' as const;

type FrequencyId = '1min' | '5min' | '10min' | 'daily' | 'weekly' | 'monthly' | 'custom';

const FREQUENCY_PRESETS: { id: FrequencyId; label: string; seconds: number }[] = [
  { id: '1min', label: '1 min', seconds: 60 },
  { id: '5min', label: '5 min', seconds: 300 },
  { id: '10min', label: '10 min', seconds: 600 },
  { id: 'daily', label: 'Daily', seconds: 86_400 },
  { id: 'weekly', label: 'Weekly', seconds: 604_800 },
  { id: 'monthly', label: 'Monthly', seconds: 2_592_000 },
  { id: 'custom', label: 'Custom', seconds: 0 },
];

const STATUS_STYLE: Record<RecurringTransaction['status'], { bg: string; fg: string; icon: typeof Clock }> = {
  active: { bg: 'bg-[#6B8F71]/10', fg: 'text-[#6B8F71]', icon: Play },
  paused: { bg: 'bg-[#D4A574]/10', fg: 'text-[#D4A574]', icon: Pause },
  completed: { bg: 'bg-[#9B72CF]/10', fg: 'text-[#9B72CF]', icon: CheckCircle },
  failed: { bg: 'bg-[#E07A5F]/10', fg: 'text-[#E07A5F]', icon: AlertTriangle },
  cancelled: { bg: 'bg-[#9B9590]/10', fg: 'text-[#9B9590]', icon: XCircle },
};

function RecurringPage(): ReactElement {
  const { items, isLoading, pause, resume, cancel, creating, create, fetchExecutions } =
    useRecurringTransactions();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#2D3436] tracking-tight flex items-center gap-2.5">
            <Repeat className="w-6 h-6 text-[#E07A5F]" /> Recurring
          </h1>
          <p className="text-[13px] text-[#6B6560] mt-1">
            Auto-execute transfers on a schedule, secured by an access key with on-chain limits.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New recurring
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9B9590] gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : items.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <RecurringRow
              key={item.id}
              item={item}
              fetchExecutions={fetchExecutions}
              onPause={() => pause(item.id)}
              onResume={() => resume(item.id)}
              onCancel={() => cancel(item.id)}
            />
          ))}
        </ul>
      )}

      <CreateRecurringModal
        open={showCreate}
        onOpenChange={setShowCreate}
        creating={creating}
        onSubmit={async input => {
          await create(input);
          setShowCreate(false);
        }}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-[#FAF8F5] p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mx-auto mb-3">
        <Repeat className="w-6 h-6 text-[#E07A5F]" />
      </div>
      <h2 className="text-[16px] font-bold text-[#2D3436]">No recurring payments yet</h2>
      <p className="text-[13px] text-[#6B6560] mt-1.5 max-w-md mx-auto">
        Schedule a recurring transfer that runs automatically until you cancel it. A dedicated
        access key with on-chain spending limits keeps it scoped and revocable.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-2">
        <Plus className="w-4 h-4" /> Create recurring
      </Button>
    </div>
  );
}

function RecurringRow({
  item,
  fetchExecutions,
  onPause,
  onResume,
  onCancel,
}: {
  item: RecurringTransaction;
  fetchExecutions: (id: string) => Promise<RecurringExecution[]>;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}): ReactElement {
  const StatusIcon = STATUS_STYLE[item.status].icon;
  const next = new Date(item.nextRunAt);
  const isFinal =
    item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled';
  const [expanded, setExpanded] = useState(false);
  const [executions, setExecutions] = useState<RecurringExecution[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Refetch when expanded; also refetch when executionsCompleted changes (the
  // DO bumps that on each run, so the list view stays roughly fresh).
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchExecutions(item.id)
      .then(rows => {
        if (!cancelled) setExecutions(rows);
      })
      .catch(e => {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, item.id, item.executionsCompleted, fetchExecutions]);

  return (
    <li className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            STATUS_STYLE[item.status].bg
          )}
        >
          <StatusIcon className={cn('w-4 h-4', STATUS_STYLE[item.status].fg)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-[#2D3436] truncate">
              {item.label ||
                `${formatAmount(BigInt(item.amount), item.tokenDecimals)} ${item.tokenSymbol}`}
            </p>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                STATUS_STYLE[item.status].bg,
                STATUS_STYLE[item.status].fg
              )}
            >
              {item.status}
            </span>
          </div>
          <p className="text-[12px] text-[#6B6560] mt-0.5 truncate">
            {formatAmount(BigInt(item.amount), item.tokenDecimals)} {item.tokenSymbol} →{' '}
            {formatAddress(item.to as Address, 6)}
            {' • every '}
            {formatInterval(item.intervalSeconds)}
            {' • runs '}
            {item.executionsCompleted}
            {item.maxExecutions ? ` / ${item.maxExecutions}` : ''}
          </p>
          {!isFinal && (
            <p className="text-[11px] text-[#9B9590] mt-0.5">Next: {format(next, 'PPpp')}</p>
          )}
          {item.lastFailReason && (
            <details className="mt-1">
              <summary className="text-[11px] text-[#E07A5F] cursor-pointer hover:underline">
                ⚠ View last error
              </summary>
              <pre className="mt-1 text-[10.5px] leading-snug text-[#E07A5F] bg-[#E07A5F]/5 border border-[#E07A5F]/20 rounded-lg p-2 whitespace-pre-wrap break-all font-mono max-h-64 overflow-auto">
                {item.lastFailReason}
              </pre>
            </details>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 rounded-lg border border-[#EDE9E3] hover:bg-[#F5F2ED] flex items-center justify-center"
            title={expanded ? 'Hide history' : 'Show history'}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#6B6560]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#6B6560]" />
            )}
          </button>
          {item.status === 'active' && (
            <button
              onClick={onPause}
              className="w-8 h-8 rounded-lg border border-[#EDE9E3] hover:bg-[#F5F2ED] flex items-center justify-center"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5 text-[#6B6560]" />
            </button>
          )}
          {item.status === 'paused' && (
            <button
              onClick={onResume}
              className="w-8 h-8 rounded-lg border border-[#EDE9E3] hover:bg-[#F5F2ED] flex items-center justify-center"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5 text-[#6B6560]" />
            </button>
          )}
          {!isFinal && (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg border border-[#EDE9E3] hover:bg-[#E07A5F]/10 flex items-center justify-center"
              title="Cancel"
            >
              <XCircle className="w-3.5 h-3.5 text-[#E07A5F]" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#EDE9E3] bg-[#FAF8F5]">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
              Execution history
            </p>
            <p className="text-[11px] text-[#9B9590]">
              {item.executionsCompleted} run{item.executionsCompleted === 1 ? '' : 's'}
            </p>
          </div>
          {historyLoading && (
            <div className="px-4 pb-4 text-[12px] text-[#9B9590] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          )}
          {historyError && (
            <div className="px-4 pb-4 text-[12px] text-[#E07A5F]">⚠ {historyError}</div>
          )}
          {!historyLoading && !historyError && executions && executions.length === 0 && (
            <div className="px-4 pb-4 text-[12px] text-[#9B9590]">No runs yet.</div>
          )}
          {!historyLoading && !historyError && executions && executions.length > 0 && (
            <ul className="divide-y divide-[#EDE9E3]">
              {executions.map(ex => (
                <ExecutionRow key={ex.id} ex={ex} symbol={item.tokenSymbol} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ExecutionRow({
  ex,
  symbol,
}: {
  ex: RecurringExecution;
  symbol: string;
}): ReactElement {
  const Icon =
    ex.status === 'success' ? CheckCircle : ex.status === 'skipped' ? SkipForward : XCircle;
  const color =
    ex.status === 'success'
      ? 'text-[#6B8F71]'
      : ex.status === 'skipped'
        ? 'text-[#D4A574]'
        : 'text-[#E07A5F]';
  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', color)} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#2D3436]">
          Run #{ex.runNumber}
          <span className={cn('ml-2 text-[11px] font-semibold uppercase tracking-wider', color)}>
            {ex.status}
          </span>
        </p>
        <p className="text-[11px] text-[#9B9590] mt-0.5">
          {format(new Date(ex.executedAt), 'PPpp')}
        </p>
        {ex.failReason && (
          <details className="mt-1">
            <summary className={cn('text-[11px] cursor-pointer hover:underline', color)}>
              View error
            </summary>
            <pre
              className={cn(
                'mt-1 text-[10.5px] leading-snug whitespace-pre-wrap break-all font-mono p-2 rounded-lg max-h-64 overflow-auto border',
                ex.status === 'failed'
                  ? 'text-[#E07A5F] bg-[#E07A5F]/5 border-[#E07A5F]/20'
                  : 'text-[#D4A574] bg-[#D4A574]/5 border-[#D4A574]/20'
              )}
            >
              {ex.failReason}
            </pre>
          </details>
        )}
      </div>
      {ex.txHash ? (
        <a
          href={getExplorerTxUrl(ex.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#E07A5F] hover:underline inline-flex items-center gap-1 flex-shrink-0 mt-0.5"
          title={ex.txHash}
        >
          {symbol} tx <ExternalLink className="w-3 h-3" />
        </a>
      ) : null}
    </li>
  );
}

function formatInterval(seconds: number): string {
  if (seconds === 86_400) return 'day';
  if (seconds === 604_800) return 'week';
  if (seconds === 2_592_000) return 'month';
  if (seconds % 86_400 === 0) return `${seconds / 86_400} days`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------

interface CreateInput {
  accessKeyDbId: string;
  accessKeyId: Address;
  accessKeySignatureType: 'secp256k1';
  accessKeyPrivateKey: Hex;
  to: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  feeToken: Address;
  intervalSeconds: number;
  startAt: string;
  endAt?: string;
  maxExecutions?: number;
  label?: string;
}

function CreateRecurringModal({
  open,
  onOpenChange,
  creating,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  onSubmit: (input: CreateInput) => Promise<void>;
}): ReactElement {
  const { address } = useTempo();
  const { tokens: tokenlist } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { authorizeKey, refresh: refreshKeys } = useAccessKeys();

  const [recipient, setRecipient] = useState('');
  const [token, setToken] = useState<Token | null>(null);

  useEffect(() => {
    if (!token && tokenlist && tokenlist.length > 0) setToken(tokenlist[0]);
  }, [tokenlist, token]);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<FrequencyId>('weekly');
  const [customSeconds, setCustomSeconds] = useState('86400');
  const [startAt, setStartAt] = useState<Date>(() => new Date(Date.now() + 60_000));
  const [endMode, setEndMode] = useState<'forever' | 'until' | 'count'>('forever');
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [maxRuns, setMaxRuns] = useState('');
  const [label, setLabel] = useState('');
  const [phase, setPhase] = useState<'form' | 'authorizing' | 'submitting'>('form');
  const [error, setError] = useState<string | null>(null);

  const intervalSeconds = useMemo(() => {
    if (frequency === 'custom') return parseInt(customSeconds, 10) || 0;
    return FREQUENCY_PRESETS.find(p => p.id === frequency)?.seconds ?? 0;
  }, [frequency, customSeconds]);

  const validationReason: string | null = useMemo(() => {
    if (!address) return 'Connect a wallet first';
    if (!isValidAddress(recipient)) return 'Recipient must be a valid 0x address';
    if (!token) return 'Pick a token';
    if (!amount || parseFloat(amount) <= 0) return 'Enter an amount';
    if (intervalSeconds < 60) return 'Interval must be at least 60 seconds';
    if (startAt.getTime() < Date.now() - 30_000) return 'Start time must be now or in the future';
    if (endMode === 'until' && (!endAt || endAt.getTime() <= startAt.getTime())) {
      return 'End date must be after start date';
    }
    if (endMode === 'count') {
      const n = parseInt(maxRuns, 10);
      if (!Number.isFinite(n) || n < 1 || n > 10_000) return 'Number of runs must be 1–10000';
    }
    return null;
  }, [address, recipient, token, amount, intervalSeconds, startAt, endMode, endAt, maxRuns]);

  async function handleSubmit() {
    if (validationReason) {
      setError(validationReason);
      return;
    }
    if (!token) return;
    setError(null);
    try {
      const amountWei = parseAmount(amount, token.decimals);
      const feeToken = (preferredFeeToken ?? DEFAULT_FEE_TOKEN_ADDRESS) as Address;

      // 1. Generate dedicated access key
      const kp = generateSecp256k1Key();

      // 2. Authorize on-chain with limits + scope
      setPhase('authorizing');
      // Mainnet keychain rejects expiry=0 as ExpiryInPast. For open-ended
      // recurrings ("forever" / "count") we set a far-future expiry — bounded
      // for safety while effectively unlimited from the user's perspective.
      const FAR_FUTURE_SECONDS = Math.floor(Date.now() / 1000) + 100 * 365 * 86_400;
      const expirySeconds =
        endMode === 'until' && endAt
          ? Math.floor(endAt.getTime() / 1000)
          : FAR_FUTURE_SECONDS;
      // Fee-token allowance for the access key. Tempo charges gas in feeToken
      // on each tx and the access keychain enforces limits for ALL tokens the
      // key wants to spend, so we must explicitly include feeToken in the
      // limits list. Generous per-period cap to cover gas across many runs.
      const FEE_BUDGET_PER_PERIOD = 100_000_000_000_000n; // ~1 USDC at 6 decimals; gas is fractions of this
      const limits =
        feeToken.toLowerCase() === (token.address as string).toLowerCase()
          ? [
              {
                token: token.address as Address,
                amount: amountWei + FEE_BUDGET_PER_PERIOD,
                period: intervalSeconds,
              },
            ]
          : [
              {
                token: token.address as Address,
                amount: amountWei,
                period: intervalSeconds,
              },
              { token: feeToken, amount: FEE_BUDGET_PER_PERIOD, period: intervalSeconds },
            ];
      await authorizeKey({
        keyId: kp.keyId,
        keyType: 'secp256k1',
        expiry: expirySeconds,
        enforceLimits: true,
        limits,
        allowedCalls: [
          {
            target: token.address as Address,
            selectors: [ERC20_TRANSFER_SELECTOR],
            selectorRecipients: { [ERC20_TRANSFER_SELECTOR]: [recipient as Address] },
          },
        ],
        label: `Recurring${label ? `: ${label}` : ''}`,
        feeToken,
      });

      // 3. Look up the dbId from the (now-saved) access key list
      await refreshKeys();
      const dbList = await apiGet<Array<{ id: string; keyId: string }>>('/v1/access-keys');
      const dbId = dbList.find(k => k.keyId.toLowerCase() === kp.keyId.toLowerCase())?.id;
      if (!dbId) throw new Error('Failed to locate the new access key');

      // 4. Create the recurring task on the server (uploads encrypted private key)
      setPhase('submitting');
      await onSubmit({
        accessKeyDbId: dbId,
        accessKeyId: kp.keyId,
        accessKeySignatureType: 'secp256k1',
        accessKeyPrivateKey: kp.privateKey,
        to: recipient as Address,
        token: token.address as Address,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        amount: amountWei.toString(),
        feeToken,
        intervalSeconds,
        startAt: startAt.toISOString(),
        endAt: endMode === 'until' && endAt ? endAt.toISOString() : undefined,
        maxExecutions: endMode === 'count' ? parseInt(maxRuns, 10) : undefined,
        label: label || undefined,
      });

      // Reset
      setPhase('form');
      setRecipient('');
      setAmount('');
      setLabel('');
    } catch (e) {
      console.error('[recurring] create failed:', e);
      setPhase('form');
      setError(e instanceof Error ? e.message : 'Failed to create recurring transaction');
    }
  }

  const tokenOptions: Token[] = tokenlist ?? [];

  return (
    <Dialog open={open} onOpenChange={creating ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-[#EDE9E3]">
          <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
            New recurring transaction
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] mt-1">
            Authorize a dedicated access key, then we'll fire the transfer on schedule.
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Recipient */}
          <Field label="Recipient">
            <ContactPicker
              value={recipient}
              onChange={setRecipient}
              placeholder="0x… or pick a contact"
            />
          </Field>

          {/* Token + amount */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <Field label="Token">
              {token ? (
                <TokenPicker token={token} tokens={tokenOptions} onChange={setToken} />
              ) : (
                <div className="h-10 rounded-lg border border-[#EDE9E3] bg-[#FAF8F5] px-3 flex items-center text-[12px] text-[#9B9590]">
                  Loading tokens…
                </div>
              )}
            </Field>
            <Field label="Amount">
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.0"
                type="number"
              />
            </Field>
          </div>

          {/* Frequency */}
          <Field label="Frequency">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {FREQUENCY_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFrequency(p.id)}
                  className={cn(
                    'h-9 rounded-lg text-[12px] font-medium border transition-colors',
                    frequency === p.id
                      ? 'border-[#E07A5F] bg-[#E07A5F]/10 text-[#E07A5F]'
                      : 'border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {frequency === 'custom' && (
              <Input
                className="mt-2"
                type="number"
                min={60}
                placeholder="Interval in seconds (min 60)"
                value={customSeconds}
                onChange={e => setCustomSeconds(e.target.value)}
              />
            )}
          </Field>

          {/* Start */}
          <Field label="Start">
            <DateTimePicker date={startAt} onDateChange={d => d && setStartAt(d)} />
          </Field>

          {/* End condition */}
          <Field label="End condition">
            <div className="grid grid-cols-3 gap-2">
              {(['forever', 'until', 'count'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEndMode(mode)}
                  className={cn(
                    'h-9 rounded-lg text-[12px] font-medium border transition-colors capitalize',
                    endMode === mode
                      ? 'border-[#E07A5F] bg-[#E07A5F]/10 text-[#E07A5F]'
                      : 'border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]'
                  )}
                >
                  {mode === 'forever' ? 'Open-ended' : mode === 'until' ? 'Until date' : 'N runs'}
                </button>
              ))}
            </div>
            {endMode === 'until' && (
              <DateTimePicker date={endAt ?? undefined} onDateChange={d => setEndAt(d ?? null)} />
            )}
            {endMode === 'count' && (
              <Input
                className="mt-2"
                type="number"
                min={1}
                max={10000}
                placeholder="Number of runs"
                value={maxRuns}
                onChange={e => setMaxRuns(e.target.value)}
              />
            )}
          </Field>

          {/* Label */}
          <Field label="Label (optional)">
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Rent" />
          </Field>

          {/* Safety note */}
          <div className="rounded-xl bg-[#FAF8F5] border border-[#EDE9E3] p-3 text-[12px] text-[#6B6560] leading-relaxed">
            We'll mint a dedicated access key restricted to <strong>this exact transfer</strong>{' '}
            (token, recipient, per-period amount cap). The key is stored encrypted at rest. You can
            revoke it on-chain at any time from the Access Keys page to instantly stop this
            recurring task.
          </div>

          {error && (
            <div className="rounded-xl bg-[#E07A5F]/10 border border-[#E07A5F]/20 p-3 text-[12px] text-[#E07A5F]">
              {error}
            </div>
          )}
        </div>

        {validationReason && phase === 'form' && (
          <p className="px-6 pb-2 text-[12px] text-[#9B9590]">
            {validationReason}
          </p>
        )}
        <div className="px-6 py-4 border-t border-[#EDE9E3] flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating || phase !== 'form'}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating || phase !== 'form' || !!validationReason}
            className="flex-1 gap-2"
          >
            {phase === 'authorizing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Authorizing key…
              </>
            ) : phase === 'submitting' || creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Create <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#6B6560] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
