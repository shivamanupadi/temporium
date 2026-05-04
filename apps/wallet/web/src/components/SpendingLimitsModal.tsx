import { type ReactElement, useState, useCallback, useEffect } from 'react';
import { Shield, AlertCircle, Loader2, Trash2, DollarSign, Plus, X, MapPin } from 'lucide-react';
import { toast } from '@/lib/toast';
import { isAddress, formatUnits, type Address } from 'viem';
import type { AllowedCallScope } from '@/hooks/useAccessKeys';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAddress, cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenAddressPicker } from '@/components/TokenAddressPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { apiGet } from '@/lib/api-client';
import type { Contact } from '@/types';
import { getTokenColors, type Token } from '@/lib/tokenlist';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { tempoChain } from '@/lib/tempo-client';
import type { TokenMetadata } from '@/types';

interface SpendingLimitsModalProps {
  keyId: string;
  isOpen: boolean;
  onClose: () => void;
  enforceLimits: boolean;
  /** Unix-seconds expiry from the on-chain key metadata. 0 means never. */
  expiry?: number;
  /** Whether the key has been revoked on-chain. */
  isRevoked?: boolean;
  updateSpendingLimit: (params: {
    keyId: Address;
    token: Address;
    newLimit: bigint;
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;
  getRemainingLimit: (
    keyId: Address,
    token: Address
  ) => Promise<{ remaining: bigint; periodEnd: bigint } | null>;
  /** Read currently-installed call scopes (allowed destinations) for the key. */
  getAllowedCalls?: (keyId: Address) => Promise<AllowedCallScope[]>;
  /** Replace the call-scope set on-chain. We always pass the full merged list. */
  setAllowedCalls?: (params: {
    keyId: Address;
    scopes: AllowedCallScope[];
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;
  onUpdated: () => Promise<void>;
}

interface LookupState {
  token: Address;
  metadata: TokenMetadata;
  remaining: bigint | null; // null = no limit configured
  /** When the current period ends (unix seconds). 0 if one-time limit. */
  periodEnd: bigint;
}

function TokenIcon({ symbol, logoURI }: { symbol: string; logoURI?: string }): ReactElement {
  const colors = getTokenColors(symbol);
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {logoURI ? (
        <img
          src={logoURI}
          alt={symbol}
          className="w-9 h-9 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign className={cn('h-4 w-4', logoURI && 'hidden')} style={{ color: colors.text }} />
    </div>
  );
}

export function SpendingLimitsModal({
  keyId,
  isOpen,
  onClose,
  enforceLimits,
  expiry = 0,
  isRevoked = false,
  updateSpendingLimit,
  getRemainingLimit,
  getAllowedCalls,
  setAllowedCalls,
  onUpdated,
}: SpendingLimitsModalProps): ReactElement {
  // The keychain precompile rejects writes against an expired or revoked key
  // with `KeyExpired` / `KeyAlreadyRevoked`. Gate the editing controls so we
  // don't waste the user's gas on a guaranteed revert.
  const isExpired = expiry > 0 && expiry * 1000 < Date.now();
  const isImmutable = isRevoked || isExpired;
  const immutableReason = isRevoked
    ? 'This key has been revoked. Authorize a new key to make changes.'
    : isExpired
      ? 'This key has expired. Authorize a new key to make changes.'
      : null;
  const { tokens: allTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  useEffect(() => {
    if (allTokens.length === 0) return;
    const preferred = preferredFeeToken
      ? allTokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = allTokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? allTokens[0]);
  }, [allTokens, preferredFeeToken]);

  // Single-screen state
  const [tokenAddress, setTokenAddress] = useState('');
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  // --- Allowed destinations state ---
  const [scopes, setScopes] = useState<AllowedCallScope[]>([]);
  const [scopesLoading, setScopesLoading] = useState(false);
  const [scopesSubmitting, setScopesSubmitting] = useState(false);
  const [newDest, setNewDest] = useState('');
  const [newDestError, setNewDestError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Modal has two tabs now — spending limits (the original concern) and
  // allowed destinations (T3+ call scopes). Default to limits to preserve
  // muscle memory for existing users.
  const [activeTab, setActiveTab] = useState<'limits' | 'destinations'>('limits');

  // Load contacts once when the modal opens so destination chips can show
  // friendly names (e.g. "Treasury — 0xabc…def") instead of bare addresses.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<Contact[]>('/v1/contacts');
        if (!cancelled) setContacts(data);
      } catch {
        /* contacts are best-effort decoration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const contactNameFor = useCallback(
    (addr: string): string | null => {
      const hit = contacts.find(c => c.address.toLowerCase() === addr.toLowerCase());
      return hit?.name ?? null;
    },
    [contacts]
  );

  // Eager validation of the destination input: fires as the user types so
  // the Add button correctly enables/disables and we surface mistakes (the
  // "I pasted the keyId itself" footgun) before paying gas.
  const newDestValidation = (() => {
    const trimmed = newDest.trim();
    if (!trimmed) return { ok: false as const, reason: null };
    if (!isAddress(trimmed)) return { ok: false as const, reason: 'Invalid address' };
    if (trimmed.toLowerCase() === keyId.toLowerCase()) {
      return { ok: false as const, reason: "Can't add the key's own address as a destination" };
    }
    if (scopes.some(s => s.target.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false as const, reason: 'Already allowed' };
    }
    return { ok: true as const, reason: null };
  })();

  const reset = useCallback(() => {
    setTokenAddress('');
    setLookup(null);
    setLookupLoading(false);
    setLookupError(null);
    setAmount('');
    setSubmitting(false);
    setRemoving(false);
    setScopes([]);
    setScopesLoading(false);
    setScopesSubmitting(false);
    setNewDest('');
    setNewDestError(null);
    setActiveTab('limits');
  }, []);

  // Load current allowed-calls scopes when the modal opens.
  useEffect(() => {
    if (!isOpen || !getAllowedCalls) return;
    let cancelled = false;
    setScopesLoading(true);
    void (async () => {
      try {
        const current = await getAllowedCalls(keyId as Address);
        if (!cancelled) setScopes(current);
      } catch (err) {
        console.warn('Failed to read allowed calls:', err);
        if (!cancelled) setScopes([]);
      } finally {
        if (!cancelled) setScopesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, keyId, getAllowedCalls]);

  const handleAddDestination = useCallback(async () => {
    if (!setAllowedCalls) return;
    const trimmed = newDest.trim();
    if (!newDestValidation.ok) {
      setNewDestError(newDestValidation.reason);
      return;
    }
    setNewDestError(null);
    setScopesSubmitting(true);
    // Append a permissive scope (any selector, any recipient) — matches the
    // "address-only" form in TIP-1011: { target, selectorRules: [] } means
    // "this key may call any function on `target` with any calldata".
    const next: AllowedCallScope[] = [...scopes, { target: trimmed as Address, selectors: [] }];
    try {
      await setAllowedCalls({
        keyId: keyId as Address,
        scopes: next,
        feeToken: feeToken?.address,
      });
      setScopes(next);
      setNewDest('');
      toast.success('Destination allowed', { description: formatAddress(trimmed, 6) });
      await onUpdated();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const friendly = /KeyExpired/i.test(msg)
        ? 'This key has expired and can no longer be modified.'
        : /KeyAlreadyRevoked|KeyRevoked/i.test(msg)
          ? 'This key has been revoked and can no longer be modified.'
          : msg;
      toast.error('Failed to add destination', { description: friendly });
    } finally {
      setScopesSubmitting(false);
    }
  }, [newDest, newDestValidation, scopes, keyId, feeToken, setAllowedCalls, onUpdated]);

  const handleRemoveDestination = useCallback(
    async (target: Address) => {
      if (!setAllowedCalls) return;
      setScopesSubmitting(true);
      // setAllowedCalls is the replace-the-set primitive. Passing the filtered
      // list is equivalent to removeAllowedCalls on the omitted target.
      const next = scopes.filter(s => s.target.toLowerCase() !== target.toLowerCase());
      try {
        await setAllowedCalls({
          keyId: keyId as Address,
          scopes: next,
          feeToken: feeToken?.address,
        });
        setScopes(next);
        toast.success('Destination removed', { description: formatAddress(target, 6) });
        await onUpdated();
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const friendly = /KeyExpired/i.test(msg)
          ? 'This key has expired and can no longer be modified.'
          : /KeyAlreadyRevoked|KeyRevoked/i.test(msg)
            ? 'This key has been revoked and can no longer be modified.'
            : msg;
        toast.error('Failed to remove destination', { description: friendly });
      } finally {
        setScopesSubmitting(false);
      }
    },
    [scopes, keyId, feeToken, setAllowedCalls, onUpdated]
  );

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Debounced auto-lookup when the token address becomes valid.
  useEffect(() => {
    const trimmed = tokenAddress.trim();
    if (!trimmed) {
      setLookup(null);
      setLookupError(null);
      setAmount('');
      return;
    }
    if (!isAddress(trimmed)) {
      setLookup(null);
      setLookupError('Invalid contract address');
      return;
    }
    if (lookup?.token.toLowerCase() === trimmed.toLowerCase()) return;

    let cancelled = false;
    setLookupLoading(true);
    setLookupError(null);

    void (async () => {
      try {
        const [metadata, limit] = await Promise.all([
          Actions.token.getMetadata(tempoPublicClient, { token: trimmed as Address }),
          getRemainingLimit(keyId as Address, trimmed as Address),
        ]);
        if (cancelled) return;
        if (!metadata || !metadata.name) {
          setLookupError('Token not found or not a valid TIP-20 token');
          setLookup(null);
          return;
        }
        const hasLimit = limit !== null && limit.periodEnd > 0n;
        const remaining = hasLimit && limit ? limit.remaining : null;
        const periodEnd = limit?.periodEnd ?? 0n;
        const decimals = metadata.decimals ?? 18;
        setLookup({
          token: trimmed as Address,
          metadata: { ...metadata, decimals } as TokenMetadata,
          remaining,
          periodEnd,
        });
        if (remaining !== null) {
          setAmount(formatUnits(remaining, decimals));
        } else {
          setAmount('');
        }
      } catch {
        if (cancelled) return;
        setLookupError('Failed to fetch token. Please check the address.');
        setLookup(null);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, keyId, getRemainingLimit, lookup?.token]);

  const parsedAmount = parseFloat(amount || '0');
  const amountValid = parsedAmount > 0;

  const handleSubmit = useCallback(async () => {
    if (!lookup || !amountValid) return;
    setSubmitting(true);
    try {
      const decimals = lookup.metadata.decimals ?? 18;
      const newLimit = BigInt(Math.floor(parsedAmount * 10 ** decimals));
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: lookup.token,
        newLimit,
        feeToken: feeToken?.address,
      });
      toast.success(lookup.remaining !== null ? 'Limit updated' : 'Limit set', {
        description: `${lookup.metadata.symbol} limit: ${formatUnits(newLimit, decimals)}`,
      });
      await onUpdated();
      // Refresh the lookup to show the new remaining.
      setLookup(prev => (prev ? { ...prev, remaining: newLimit } : prev));
    } catch (err) {
      toast.error('Failed to update limit', {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [lookup, amountValid, parsedAmount, keyId, feeToken, updateSpendingLimit, onUpdated]);

  const handleRemove = useCallback(async () => {
    if (!lookup || lookup.remaining === null) return;
    setRemoving(true);
    try {
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: lookup.token,
        newLimit: 0n,
        feeToken: feeToken?.address,
      });
      toast.success('Limit removed', {
        description: `${lookup.metadata.symbol} limit cleared.`,
      });
      await onUpdated();
      setLookup(prev => (prev ? { ...prev, remaining: null } : prev));
      setAmount('');
    } catch (err) {
      toast.error('Failed to remove limit', {
        description: (err as Error).message,
      });
    } finally {
      setRemoving(false);
    }
  }, [lookup, keyId, feeToken, updateSpendingLimit, onUpdated]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const hasLimit = lookup?.remaining !== null && lookup?.remaining !== undefined;
  const decimals = lookup?.metadata.decimals ?? 18;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="p-0 gap-0 max-w-[440px] rounded-3xl overflow-visible border-none shadow-[0_20px_50px_-20px_rgba(45,52,54,0.2)]">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-[#FDFBF8] border-b border-[#EDE9E3] rounded-t-3xl">
          <div className="pr-10">
            <DialogTitle className="text-[15px] font-semibold text-[#2D3436] tracking-tight leading-tight">
              Manage Spending Limits
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#9B9590] mt-0.5 font-mono">
              Key {formatAddress(keyId, 6)}
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 min-h-[380px]">
          {immutableReason && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E07A5F]/10 border border-[#E07A5F]/20">
              <AlertCircle className="w-4 h-4 text-[#E07A5F] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#E07A5F] leading-relaxed">{immutableReason}</p>
            </div>
          )}

          {/* Tab switcher — only renders when destinations are wired up. */}
          {setAllowedCalls && getAllowedCalls && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F5F2ED]">
              <button
                type="button"
                onClick={() => setActiveTab('limits')}
                className={`h-8 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'limits'
                    ? 'bg-white text-[#2D3436] shadow-sm'
                    : 'text-[#9B9590] hover:text-[#6B6560]'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Spending Limits
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('destinations')}
                className={`h-8 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'destinations'
                    ? 'bg-white text-[#2D3436] shadow-sm'
                    : 'text-[#9B9590] hover:text-[#6B6560]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Destinations
                {scopes.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#5B9A6F]/15 text-[10px] font-semibold text-[#5B9A6F]">
                    {scopes.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ---- Spending Limits tab ---- */}
          {activeTab === 'limits' && (
            <>
              {!enforceLimits && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]">
                  <Shield className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-[#9B9590] leading-relaxed">
                    This key was authorized with unlimited spending. Setting a limit here will not
                    take effect unless the key was created with limits enabled.
                  </p>
                </div>
              )}

              {/* Token picker */}
              <TokenAddressPicker
                value={tokenAddress}
                onChange={val => {
                  setTokenAddress(val);
                  setLookupError(null);
                }}
                label="Token"
                showValidation={false}
              />

              {lookupError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11.5px] text-[#E5484D]">{lookupError}</p>
                </div>
              )}

              {/* Status card - appears after a successful lookup */}
              {lookup && !lookupLoading && (
                <div
                  className={`rounded-2xl border p-3.5 flex items-center gap-3 ${
                    hasLimit
                      ? 'border-[#6B8F71]/20 bg-[#6B8F71]/[0.05]'
                      : 'border-[#EDE9E3] bg-[#FDFBF8]'
                  }`}
                >
                  <TokenIcon
                    symbol={lookup.metadata.symbol}
                    logoURI={
                      allTokens.find(t => t.address.toLowerCase() === lookup.token.toLowerCase())
                        ?.logoURI
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2D3436]">
                      {lookup.metadata.symbol}
                      <span className="font-normal text-[#9B9590] ml-1.5 text-[11.5px]">
                        {lookup.metadata.name}
                      </span>
                    </p>
                    <p className="text-[11.5px] mt-0.5">
                      {hasLimit ? (
                        <span className="text-[#6B8F71] font-medium">
                          {formatUnits(lookup.remaining as bigint, decimals)} remaining
                          {lookup.periodEnd > 1n && (
                            <span className="text-[#9B9590] font-normal ml-1">
                              · resets{' '}
                              {new Date(Number(lookup.periodEnd) * 1000).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#9B9590]">No limit set</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {lookupLoading && (
                <div className="rounded-2xl border border-[#EDE9E3] bg-white p-3.5 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[#B5B0AA]" />
                  <p className="text-[12px] text-[#9B9590]">Checking token…</p>
                </div>
              )}

              {/* Amount input - only shown when we have a valid token */}
              {lookup && !lookupLoading && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    {hasLimit ? 'New Limit' : 'Set Limit'}
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="0.00"
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="h-11 rounded-xl text-[13px] border-[#EDE9E3] pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#9B9590]">
                      {lookup.metadata.symbol}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B5B0AA]">
                    Max {lookup.metadata.symbol} this key can spend from your account. The refresh
                    period is set at key creation and can&apos;t be changed here.
                  </p>
                </div>
              )}

              {/* Fee token */}
              {lookup && !lookupLoading && feeToken && allTokens.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                  <FeeTokenPicker value={feeToken} tokens={allTokens} onChange={setFeeToken} />
                </div>
              )}
            </>
          )}

          {/* ---- Allowed Destinations tab (T3+ call scopes) ---- */}
          {activeTab === 'destinations' && setAllowedCalls && getAllowedCalls && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#B5B0AA]">
                {scopes.length === 0
                  ? 'This key can call any contract. Add destinations to restrict it.'
                  : `This key can only call the ${scopes.length} contract${scopes.length === 1 ? '' : 's'} listed below.`}
              </p>

              {scopesLoading ? (
                <div className="flex items-center gap-2 text-[11.5px] text-[#9B9590]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading current scopes…
                </div>
              ) : (
                <>
                  {scopes.length > 0 && (
                    <div className="space-y-1.5">
                      {scopes.map(scope => {
                        const name = contactNameFor(scope.target);
                        return (
                          <div
                            key={scope.target}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F5F2ED] border border-[#EDE9E3]"
                          >
                            <div className="min-w-0 flex-1">
                              {name && (
                                <p className="text-[12px] font-medium text-[#2D3436] truncate">
                                  {name}
                                </p>
                              )}
                              <p
                                className={`text-[11px] font-mono truncate ${name ? 'text-[#9B9590]' : 'text-[#2D3436]'}`}
                              >
                                {formatAddress(scope.target, 8)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDestination(scope.target)}
                              disabled={scopesSubmitting || isImmutable}
                              className="p-1 rounded text-[#9B9590] hover:text-[#E5484D] hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#9B9590]"
                              aria-label="Remove destination"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <ContactPicker
                        value={newDest}
                        onChange={val => {
                          setNewDest(val);
                          if (newDestError) setNewDestError(null);
                        }}
                        placeholder="0x… contract address"
                        compact
                        showValidation={false}
                      />
                    </div>
                    <Button
                      onClick={handleAddDestination}
                      disabled={scopesSubmitting || !newDestValidation.ok || isImmutable}
                      className="h-9 px-3 rounded-lg text-[12px] font-semibold bg-[#5B9A6F] hover:bg-[#4F8961] text-white gap-1 shrink-0 disabled:opacity-50"
                    >
                      {scopesSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Add
                    </Button>
                  </div>
                  {(newDestError ?? (newDest.trim() ? newDestValidation.reason : null)) && (
                    <p className="text-[11px] text-[#E5484D] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {newDestError ?? newDestValidation.reason}
                    </p>
                  )}

                  {/* Fee token picker (so the user can pick what gas is paid in
                      before each add/remove tx). */}
                  {feeToken && allTokens.length > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                      <FeeTokenPicker value={feeToken} tokens={allTokens} onChange={setFeeToken} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {activeTab === 'limits' && hasLimit && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={removing || submitting || isImmutable}
              className="h-12 px-4 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting || removing || scopesSubmitting}
            className="flex-1 h-12 border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            Close
          </Button>
          {activeTab === 'limits' && (
            <Button
              onClick={handleSubmit}
              disabled={!lookup || !amountValid || submitting || removing || isImmutable}
              className="flex-1 h-12 text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15 hover:shadow-xl hover:shadow-[#E07A5F]/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : hasLimit ? (
                'Update Limit'
              ) : (
                'Set Limit'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
