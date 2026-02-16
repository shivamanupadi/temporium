import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { isAddress, type Address } from 'viem';
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Plus,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenAddressPicker } from '@/components/TokenAddressPicker';
import { useTempo } from '@/hooks/useTempo';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useApprovals, type ApprovalEntry } from '@/hooks/useApprovals';
import { Actions, tempoChain, tempoPublicClient, waitForTx } from '@/lib/tempo-client';
import { formatAmount, formatAddress } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';
import type { TokenMetadata } from '@/types';

const MAX_UINT256 = 2n ** 256n - 1n;

const KNOWN_SPENDERS: { address: Address; label: string }[] = [
  { address: '0xdec0000000000000000000000000000000000000' as Address, label: 'Stablecoin DEX' },
  { address: '0x20fc000000000000000000000000000000000000' as Address, label: 'TIP-20 Factory' },
  { address: '0xfeec000000000000000000000000000000000000' as Address, label: 'Fee Manager' },
  { address: '0xcccccccc00000000000000000000000000000000' as Address, label: 'Validator' },
];

export const Route = createFileRoute('/portal/token-approvals')({
  component: ApprovalsPage,
});

type AddStep = 'token-spender' | 'amount';

function ApprovalsPage(): ReactElement | null {
  const { address, isConnected, approveToken } = useTempo();
  const { preferredFeeToken } = useFeePreference();
  const { approvals, isLoading, refresh } = useApprovals();

  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  // Auto-resolve fee token from preference or chain default
  const feeTokenAddress = preferredFeeToken || tempoChain.feeToken;

  // --- Add Approval dialog state ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>('token-spender');
  const [addTokenAddress, setAddTokenAddress] = useState('');
  const [addSpender, setAddSpender] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addUnlimited, setAddUnlimited] = useState(false);
  const [addTokenMeta, setAddTokenMeta] = useState<TokenMetadata | null>(null);
  const [addValidating, setAddValidating] = useState(false);
  const [addSpenderCustom, setAddSpenderCustom] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const resetAddForm = useCallback(() => {
    setAddStep('token-spender');
    setAddTokenAddress('');
    setAddSpender('');
    setAddSpenderCustom(false);
    setAddAmount('');
    setAddUnlimited(false);
    setAddTokenMeta(null);
    setAddValidating(false);
    setAddError(null);
    setAddSubmitting(false);
  }, []);

  const handleOpenAdd = useCallback(() => {
    resetAddForm();
    setIsAddOpen(true);
  }, [resetAddForm]);

  const handleValidateAndNext = useCallback(async () => {
    const tokenTrimmed = addTokenAddress.trim();
    const spenderTrimmed = addSpender.trim();

    if (!tokenTrimmed) {
      setAddError('Please enter a token address');
      return;
    }
    if (!isAddress(tokenTrimmed)) {
      setAddError('Invalid token address format');
      return;
    }
    if (!spenderTrimmed) {
      setAddError('Please enter or select a spender address');
      return;
    }
    if (!isAddress(spenderTrimmed)) {
      setAddError('Invalid spender address format');
      return;
    }

    setAddValidating(true);
    setAddError(null);
    try {
      // Validate custom spender has a deployed contract (skip for known precompiles)
      const isKnownSpender = KNOWN_SPENDERS.some(
        s => s.address.toLowerCase() === spenderTrimmed.toLowerCase()
      );
      if (!isKnownSpender) {
        const code = await tempoPublicClient.getCode({ address: spenderTrimmed as Address });
        if (!code || code === '0x') {
          setAddError('No contract found at this spender address');
          setAddValidating(false);
          return;
        }
      }

      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: tokenTrimmed as Address,
      });
      if (!metadata || !metadata.name) {
        setAddError('Token not found or not a valid TIP-20 token');
        return;
      }
      setAddTokenMeta(metadata as TokenMetadata);
      setAddStep('amount');
    } catch {
      setAddError('Failed to fetch token. Please check the address.');
    } finally {
      setAddValidating(false);
    }
  }, [addTokenAddress, addSpender]);

  const handleConfirmApproval = useCallback(async () => {
    if (addSubmitting) return;
    const tokenTrimmed = addTokenAddress.trim() as Address;
    const spenderTrimmed = addSpender.trim() as Address;

    let amount: bigint;
    if (addUnlimited) {
      amount = MAX_UINT256;
    } else {
      const parsed = parseFloat(addAmount);
      if (!addAmount || isNaN(parsed) || parsed <= 0) {
        setAddError('Please enter a valid amount');
        return;
      }
      const decimals = addTokenMeta?.decimals ?? 18;
      amount = BigInt(Math.floor(parsed * 10 ** decimals));
    }

    setAddSubmitting(true);
    setAddError(null);
    try {
      const hash = await approveToken({
        token: tokenTrimmed,
        spender: spenderTrimmed,
        amount,
        feeToken: feeTokenAddress,
      });
      await waitForTx(hash as `0x${string}`);
      toast.success(
        `Approved ${addTokenMeta?.symbol ?? 'token'} for ${KNOWN_SPENDERS.find(s => s.address.toLowerCase() === spenderTrimmed.toLowerCase())?.label ?? formatAddress(spenderTrimmed, 4)}`
      );
      setIsAddOpen(false);
      resetAddForm();
      refresh();
    } catch (err) {
      console.error('Approve failed:', err);
      const message = err instanceof Error ? err.message : 'Approval failed';
      setAddError(message);
    } finally {
      setAddSubmitting(false);
    }
  }, [
    addSubmitting,
    addTokenAddress,
    addSpender,
    addUnlimited,
    addAmount,
    addTokenMeta,
    feeTokenAddress,
    approveToken,
    resetAddForm,
    refresh,
  ]);

  const handleRevoke = useCallback(
    async (approval: ApprovalEntry) => {
      if (revokingKey) return;
      const key = `${approval.token.address}-${approval.spender}`;
      setRevokingKey(key);
      try {
        const hash = await approveToken({
          token: approval.token.address,
          spender: approval.spender,
          amount: 0n,
          feeToken: feeTokenAddress,
        });
        await waitForTx(hash as `0x${string}`);
        toast.success(`Revoked ${approval.spenderLabel} approval for ${approval.token.symbol}`);
        refresh();
      } catch (err) {
        console.error('Revoke failed:', err);
        const message = err instanceof Error ? err.message : 'Revoke failed';
        toast.error(message);
      } finally {
        setRevokingKey(null);
      }
    },
    [feeTokenAddress, revokingKey, approveToken, refresh]
  );

  if (!isConnected || !address) return null;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Token Approvals</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">Manage your token spending allowances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={isLoading}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Approval
          </Button>
        </div>
      </motion.div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F2ED]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[#F5F2ED] rounded" />
                  <div className="h-3 w-20 bg-[#F5F2ED] rounded" />
                </div>
                <div className="h-9 w-20 bg-[#F5F2ED] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approvals list */}
      {!isLoading && approvals.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {approvals.map(approval => {
            const colors = getTokenColors(approval.token.symbol);
            const key = `${approval.token.address}-${approval.spender}`;
            const isRevoking = revokingKey === key;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5"
              >
                <div className="flex items-center gap-4">
                  {/* Token icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {approval.token.logoURI ? (
                      <img
                        src={approval.token.logoURI}
                        alt={approval.token.symbol}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      approval.token.symbol.slice(0, 2)
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#2D3436]">
                      {approval.token.symbol}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#9B9590]">Spender:</span>
                      <span className="text-[11px] font-medium text-[#6B6560] bg-[#F5F2ED] px-1.5 py-0.5 rounded">
                        {approval.spenderLabel}
                      </span>
                      <span className="text-[11px] font-mono text-[#B5B0AA]">
                        {formatAddress(approval.spender, 4)}
                      </span>
                    </div>
                  </div>

                  {/* Allowance amount */}
                  <div className="text-right mr-3">
                    {approval.isUnlimited ? (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <p className="text-[13px] font-bold text-amber-600">Unlimited</p>
                      </div>
                    ) : (
                      <p className="text-[13px] font-bold text-[#2D3436]">
                        {formatAmount(approval.allowance, approval.token.decimals, 2)}
                      </p>
                    )}
                    <p className="text-[11px] text-[#9B9590] uppercase tracking-wider">Allowance</p>
                  </div>

                  {/* Revoke button */}
                  <Button
                    disabled={isRevoking}
                    onClick={() => handleRevoke(approval)}
                    variant="outline"
                    className="h-9 px-4 rounded-xl text-[13px] font-semibold border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all"
                  >
                    {isRevoking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
                        Revoke
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && approvals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-[#B5B0AA]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#2D3436]">No Active Approvals</h3>
          <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
            You haven&apos;t granted any token spending allowances. Add an approval to authorize a
            spender.
          </p>
          <Button
            onClick={handleOpenAdd}
            variant="outline"
            className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Approval
          </Button>
        </motion.div>
      )}

      {/* Add Approval Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={open => {
          if (!open && !addSubmitting) {
            setIsAddOpen(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent className="p-0 gap-0 max-w-[400px]">
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              {addStep === 'token-spender' ? 'Add Approval' : 'Set Amount'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              {addStep === 'token-spender'
                ? 'Select a token and spender to approve.'
                : 'Choose the allowance amount for this approval.'}
            </DialogDescription>
          </div>
          <div className="border-t border-[#EDE9E3]/60" />

          {addStep === 'token-spender' ? (
            <div className="px-6 py-5 space-y-4">
              <TokenAddressPicker
                value={addTokenAddress}
                onChange={val => {
                  setAddTokenAddress(val);
                  setAddError(null);
                }}
                label="Token Address"
                showValidation={false}
                inputClassName="focus:border-sage/40"
              />

              {/* Spender section */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Spender Address
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {KNOWN_SPENDERS.map(spender => {
                    const isSelected = addSpender.toLowerCase() === spender.address.toLowerCase();
                    return (
                      <button
                        key={spender.address}
                        type="button"
                        onClick={() => {
                          setAddSpenderCustom(false);
                          setAddSpender(spender.address);
                          setAddError(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                          !addSpenderCustom && isSelected
                            ? 'bg-sage text-white'
                            : 'bg-[#F5F2ED] text-[#6B6560] hover:bg-[#EDE9E3]'
                        }`}
                      >
                        {spender.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setAddSpenderCustom(true);
                      setAddSpender('');
                      setAddError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                      addSpenderCustom
                        ? 'bg-sage text-white'
                        : 'bg-[#F5F2ED] text-[#6B6560] hover:bg-[#EDE9E3]'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="0x..."
                  value={addSpender}
                  disabled={!addSpenderCustom}
                  onChange={e => {
                    setAddSpender(e.target.value.trim());
                    setAddError(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-sage/40 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {addError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11px] text-[#E5484D]">{addError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {/* Token metadata summary */}
              {addTokenMeta && (
                <div className="rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Token</span>
                    <span className="text-[12px] font-semibold text-[#2D3436]">
                      {addTokenMeta.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Symbol</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      {addTokenMeta.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Decimals</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      {addTokenMeta.decimals}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Spender</span>
                    <span className="text-[11px] font-medium text-[#6B6560]">
                      {KNOWN_SPENDERS.find(
                        s => s.address.toLowerCase() === addSpender.trim().toLowerCase()
                      )?.label ?? formatAddress(addSpender.trim(), 6)}
                    </span>
                  </div>
                </div>
              )}

              {/* Unlimited toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-[#EDE9E3]">
                <div>
                  <Label className="text-[12px] font-semibold text-[#6B6560]">
                    Unlimited Approval
                  </Label>
                  <p className="text-[11px] text-[#B5B0AA] mt-0.5">
                    Approve maximum possible amount.
                  </p>
                </div>
                <Switch
                  checked={addUnlimited}
                  onCheckedChange={checked => {
                    setAddUnlimited(checked);
                    if (checked) setAddAmount('');
                    setAddError(null);
                  }}
                />
              </div>

              {/* Amount input */}
              {!addUnlimited && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Amount
                  </Label>
                  <Input
                    placeholder="0.00"
                    type="number"
                    value={addAmount}
                    onChange={e => {
                      setAddAmount(e.target.value);
                      setAddError(null);
                    }}
                    className="h-10 rounded-xl text-[13px] border-[#EDE9E3]"
                  />
                  {addTokenMeta && (
                    <p className="text-[11px] text-[#B5B0AA]">
                      Amount of {addTokenMeta.symbol} to approve.
                    </p>
                  )}
                </div>
              )}

              {addUnlimited && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Unlimited approval grants the spender access to all of your{' '}
                    {addTokenMeta?.symbol ?? 'token'} balance. Use with caution.
                  </p>
                </div>
              )}

              {addError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11px] text-[#E5484D]">{addError}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 pb-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (addStep === 'amount') {
                  setAddStep('token-spender');
                  setAddTokenMeta(null);
                  setAddAmount('');
                  setAddUnlimited(false);
                  setAddError(null);
                } else {
                  setIsAddOpen(false);
                  resetAddForm();
                }
              }}
              disabled={addSubmitting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            >
              {addStep === 'amount' ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Back
                </>
              ) : (
                'Cancel'
              )}
            </Button>
            {addStep === 'token-spender' ? (
              <Button
                onClick={handleValidateAndNext}
                disabled={addValidating || !addTokenAddress.trim() || !addSpender.trim()}
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white gap-2"
              >
                {addValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Continue
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleConfirmApproval}
                disabled={
                  addSubmitting || (!addUnlimited && (!addAmount || parseFloat(addAmount) <= 0))
                }
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white gap-2"
              >
                {addSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Approve
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
