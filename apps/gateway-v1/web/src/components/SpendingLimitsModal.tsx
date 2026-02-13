import { type ReactElement, useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Shield,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Coins,
  Pencil,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { isAddress, formatUnits, type Address } from 'viem';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAddress } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenAddressPicker } from '@/components/TokenAddressPicker';
import { getTokens, type Token } from '@/lib/tokenlist';
import type { TokenMetadata } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpendingLimitDisplay {
  token: Address;
  remaining: bigint;
  symbol: string;
  name: string;
  decimals: number;
}

type ModalView = 'list' | 'edit' | 'add';

interface SpendingLimitsModalProps {
  keyId: string;
  isOpen: boolean;
  onClose: () => void;
  enforceLimits: boolean;
  updateSpendingLimit: (params: {
    keyId: Address;
    token: Address;
    newLimit: bigint;
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;
  getRemainingLimit: (keyId: Address, token: Address) => Promise<bigint>;
  onUpdated: () => Promise<void>;
}

export function SpendingLimitsModal({
  keyId,
  isOpen,
  onClose,
  enforceLimits,
  updateSpendingLimit,
  getRemainingLimit,
  onUpdated,
}: SpendingLimitsModalProps): ReactElement {
  // Fetched spending limits
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimitDisplay[]>([]);
  const [loadingLimits, setLoadingLimits] = useState(false);

  // View state
  const [view, setView] = useState<ModalView>('list');

  // Edit state
  const [editingLimit, setEditingLimit] = useState<SpendingLimitDisplay | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  // Add state
  const [tlAddress, setTlAddress] = useState('');
  const [tlAmount, setTlAmount] = useState('');
  const [tlMetadata, setTlMetadata] = useState<TokenMetadata | null>(null);
  const [tlStep, setTlStep] = useState<'address' | 'amount'>('address');
  const [tlValidating, setTlValidating] = useState(false);
  const [tlError, setTlError] = useState<string | null>(null);
  const [tlSubmitting, setTlSubmitting] = useState(false);

  // --- Fetch spending limits when modal opens ---
  const fetchLimits = useCallback(async () => {
    if (!keyId) return;

    setLoadingLimits(true);
    try {
      const tokens = await getTokens();
      const results: SpendingLimitDisplay[] = [];

      await Promise.all(
        tokens.map(async (token: Token) => {
          try {
            const remaining = await getRemainingLimit(keyId as Address, token.address);
            if (remaining > 0n) {
              results.push({
                token: token.address,
                remaining,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
              });
            }
          } catch {
            // skip tokens that fail
          }
        })
      );

      setSpendingLimits(results);
    } catch (err) {
      console.error('Failed to fetch spending limits:', err);
      setSpendingLimits([]);
    } finally {
      setLoadingLimits(false);
    }
  }, [keyId, getRemainingLimit]);

  useEffect(() => {
    if (isOpen && keyId) {
      fetchLimits();
    }
    if (!isOpen) {
      setSpendingLimits([]);
      setView('list');
      setEditingLimit(null);
    }
  }, [isOpen, keyId, fetchLimits]);

  const resetAddState = useCallback(() => {
    setTlAddress('');
    setTlAmount('');
    setTlMetadata(null);
    setTlStep('address');
    setTlValidating(false);
    setTlError(null);
    setTlSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    setView('list');
    setEditingLimit(null);
    setEditAmount('');
    resetAddState();
    onClose();
  }, [onClose, resetAddState]);

  const goToList = useCallback(() => {
    setView('list');
    setEditingLimit(null);
    setEditAmount('');
    resetAddState();
  }, [resetAddState]);

  // --- Add flow ---
  const openAdd = useCallback(() => {
    resetAddState();
    setView('add');
  }, [resetAddState]);

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

    if (spendingLimits.some(l => l.token.toLowerCase() === trimmed.toLowerCase())) {
      setTlError('This token already has a spending limit. Edit it instead.');
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
  }, [tlAddress, spendingLimits]);

  const handleAddLimit = useCallback(async () => {
    if (!tlMetadata || !tlAmount || parseFloat(tlAmount) <= 0) return;

    setTlSubmitting(true);
    try {
      const decimals = tlMetadata.decimals || 18;
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: tlAddress.trim() as Address,
        newLimit: BigInt(Math.floor(parseFloat(tlAmount) * 10 ** decimals)),
      });
      toast.success('Spending limit added', {
        description: `${tlMetadata.symbol} limit set for key ${formatAddress(keyId, 6)}.`,
      });
      await onUpdated();
      resetAddState();
      setView('list');
      await fetchLimits();
    } catch (err) {
      toast.error('Failed to add spending limit', {
        description: (err as Error).message,
      });
    } finally {
      setTlSubmitting(false);
    }
  }, [
    tlMetadata,
    tlAddress,
    tlAmount,
    keyId,
    updateSpendingLimit,
    onUpdated,
    resetAddState,
    fetchLimits,
  ]);

  // --- Edit flow ---
  const openEdit = useCallback((sl: SpendingLimitDisplay) => {
    setEditingLimit(sl);
    setEditAmount(formatUnits(sl.remaining, sl.decimals));
    setView('edit');
  }, []);

  const handleUpdateLimit = useCallback(async () => {
    if (!editingLimit || !editAmount || parseFloat(editAmount) <= 0) return;

    setEditSubmitting(true);
    try {
      const decimals = editingLimit.decimals || 18;
      await updateSpendingLimit({
        keyId: keyId as Address,
        token: editingLimit.token as Address,
        newLimit: BigInt(Math.floor(parseFloat(editAmount) * 10 ** decimals)),
      });
      toast.success('Spending limit updated', {
        description: `${editingLimit.symbol || formatAddress(editingLimit.token, 4)} limit updated.`,
      });
      await onUpdated();
      goToList();
      await fetchLimits();
    } catch (err) {
      toast.error('Failed to update spending limit', {
        description: (err as Error).message,
      });
    } finally {
      setEditSubmitting(false);
    }
  }, [editingLimit, editAmount, keyId, updateSpendingLimit, onUpdated, goToList, fetchLimits]);

  // --- Delete ---
  const handleDeleteLimit = useCallback(
    async (sl: SpendingLimitDisplay) => {
      setDeletingToken(sl.token);
      try {
        await updateSpendingLimit({
          keyId: keyId as Address,
          token: sl.token as Address,
          newLimit: 0n,
        });
        toast.success('Spending limit removed', {
          description: `${sl.symbol || formatAddress(sl.token, 4)} limit removed.`,
        });
        await onUpdated();
        await fetchLimits();
      } catch (err) {
        toast.error('Failed to remove spending limit', {
          description: (err as Error).message,
        });
      } finally {
        setDeletingToken(null);
      }
    },
    [keyId, updateSpendingLimit, onUpdated, fetchLimits]
  );

  // --- Title & description per view ---
  const title =
    view === 'edit'
      ? `Edit Limit: ${editingLimit?.symbol || formatAddress(editingLimit?.token ?? '', 4)}`
      : view === 'add'
        ? 'Add Token Limit'
        : 'Spending Limits';

  const description =
    view === 'edit'
      ? 'Update the spending limit for this token.'
      : view === 'add'
        ? 'Look up a token on-chain and set a spending limit.'
        : `Manage token spending limits for key ${formatAddress(keyId, 6)}.`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="p-0 gap-0 max-w-[420px] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[18px] font-bold text-[#2D3436]">{title}</DialogTitle>
          <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
            {description}
          </DialogDescription>
        </div>
        <div className="border-t border-[#EDE9E3]/60" />

        {view === 'edit' && editingLimit ? (
          /* --- EDIT VIEW --- */
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-3 space-y-2">
                {editingLimit.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Token</span>
                    <span className="text-[12px] font-semibold text-[#2D3436]">
                      {editingLimit.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9B9590]">Symbol</span>
                  <span className="text-[12px] font-medium text-[#2D3436]">
                    {editingLimit.symbol || '–'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9B9590]">Current Remaining</span>
                  <span className="text-[12px] font-mono font-medium text-[#2D3436]">
                    {formatUnits(editingLimit.remaining, editingLimit.decimals)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9B9590]">Address</span>
                  <span className="text-[11px] font-mono text-[#9B9590]">
                    {formatAddress(editingLimit.token, 6)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  New Spending Limit
                </Label>
                <Input
                  placeholder="0.00"
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="h-10 rounded-xl text-[13px] border-[#EDE9E3]"
                />
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#9B72CF]/[0.06] border border-[#9B72CF]/15">
                <Shield className="w-4 h-4 text-[#9B72CF] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#9B72CF]/80 leading-relaxed">
                  This will send a transaction to update the spending limit on-chain.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-0 flex gap-3">
              <Button
                variant="outline"
                onClick={goToList}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
              <Button
                onClick={handleUpdateLimit}
                disabled={editSubmitting || !editAmount || parseFloat(editAmount) <= 0}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
              >
                {editSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    Update Limit
                  </>
                )}
              </Button>
            </div>
          </>
        ) : view === 'add' ? (
          /* --- ADD VIEW --- */
          <>
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
                    goToList();
                  }
                }}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
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
                  onClick={handleAddLimit}
                  disabled={tlSubmitting || !tlAmount || parseFloat(tlAmount) <= 0}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
                >
                  {tlSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Add Limit
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          /* --- LIST VIEW --- */
          <>
            <div className="px-6 py-5 space-y-3">
              {!enforceLimits && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]">
                  <Shield className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#9B9590] leading-relaxed">
                    Spending limits are not enforced for this key. Adding a limit will not take
                    effect unless the key was created with limits enabled.
                  </p>
                </div>
              )}

              {loadingLimits ? (
                <div className="rounded-xl border border-dashed border-[#EDE9E3] bg-white p-6 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mx-auto mb-2" />
                  <p className="text-[12px] text-[#9B9590]">Loading spending limits...</p>
                </div>
              ) : spendingLimits.length > 0 ? (
                <div className="space-y-2">
                  {spendingLimits.map(sl => (
                    <div
                      key={sl.token}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#9B72CF]/10 flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4 text-[#9B72CF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#2D3436]">
                          {sl.symbol || formatAddress(sl.token, 4)}
                          {sl.name && (
                            <span className="font-normal text-[#9B9590] ml-1">({sl.name})</span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#9B9590] font-mono">
                          {formatUnits(sl.remaining, sl.decimals)} remaining
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(sl)}
                          className="w-8 h-8 rounded-lg text-[#B5B0AA] hover:text-[#9B72CF] hover:bg-[#9B72CF]/10"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLimit(sl)}
                          disabled={deletingToken === sl.token}
                          className="w-8 h-8 rounded-lg text-[#B5B0AA] hover:text-[#E07A5F] hover:bg-[#E07A5F]/10"
                        >
                          {deletingToken === sl.token ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#EDE9E3] bg-white p-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2.5">
                    <Coins className="w-5 h-5 text-[#B5B0AA]" />
                  </div>
                  <p className="text-[12px] text-[#9B9590]">No spending limits configured.</p>
                  <Button
                    variant="outline"
                    onClick={openAdd}
                    className="mt-3 h-9 px-5 rounded-xl text-[12px] font-semibold border-[#EDE9E3] gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Limit
                  </Button>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-0 flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
              >
                Close
              </Button>
              {spendingLimits.length > 0 && (
                <Button
                  onClick={openAdd}
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-coral hover:bg-coral/80 text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Limit
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
