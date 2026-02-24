import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isAddress, type Address } from 'viem';
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Search,
  Bookmark,
  Info,
  X,
  Check,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTempo } from '@/hooks/useTempo';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useApprovals, type ApprovalEntry } from '@/hooks/useApprovals';
import { tempoChain, tempoPublicClient, waitForTx } from '@/lib/tempo-client';
import { formatAmount, formatAddress } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/token-approvals')({
  component: ApprovalsPage,
});

function ApprovalsPage(): ReactElement | null {
  const { address, isConnected, approveToken } = useTempo();
  const { preferredFeeToken } = useFeePreference();
  const { approvals, isLoading, refresh, saveSpender } = useApprovals();

  const feeTokenAddress = preferredFeeToken || tempoChain.feeToken;

  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  // --- Check Contract state ---
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkAddress, setCheckAddress] = useState('');
  const [checkLabel, setCheckLabel] = useState('');
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  // --- Inline save-to-watchlist state (per spender) ---
  const [savingSpender, setSavingSpender] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState('');
  const [savingInProgress, setSavingInProgress] = useState(false);

  const handleCheckContract = useCallback(async () => {
    const addr = checkAddress.trim();
    if (!addr) {
      setCheckError('Please enter a contract address');
      return;
    }
    if (!isAddress(addr)) {
      setCheckError('Invalid address format');
      return;
    }

    setCheckLoading(true);
    setCheckError(null);
    try {
      const code = await tempoPublicClient.getCode({ address: addr as Address });
      if (!code || code === '0x') {
        setCheckError('No contract found at this address');
        return;
      }

      await saveSpender(addr as Address, checkLabel.trim() || undefined);
      toast.success('Contract added to watchlist');
      setCheckOpen(false);
      setCheckAddress('');
      setCheckLabel('');
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add contract';
      if (message.includes('already exists')) {
        setCheckError('This contract is already in your watchlist');
      } else {
        setCheckError(message);
      }
    } finally {
      setCheckLoading(false);
    }
  }, [checkAddress, checkLabel, saveSpender, refresh]);

  const handleSaveToWatchlist = useCallback(
    async (spenderAddress: Address) => {
      setSavingInProgress(true);
      try {
        await saveSpender(spenderAddress, saveLabel.trim() || undefined);
        toast.success('Spender saved to watchlist');
        setSavingSpender(null);
        setSaveLabel('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
      } finally {
        setSavingInProgress(false);
      }
    },
    [saveSpender, saveLabel]
  );

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
            onClick={() => setCheckOpen(prev => !prev)}
            variant={checkOpen ? 'default' : 'outline'}
            className={
              checkOpen
                ? 'h-10 px-5 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white'
                : 'h-10 px-5 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]'
            }
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Check Contract
          </Button>
        </div>
      </motion.div>

      {/* Check Contract inline form */}
      <AnimatePresence>
        {checkOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#2D3436]">
                  Check a contract for approvals
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckOpen(false);
                    setCheckAddress('');
                    setCheckLabel('');
                    setCheckError(null);
                  }}
                  className="text-[#9B9590] hover:text-[#6B6560] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3">
                <Input
                  placeholder="Contract address (0x...)"
                  value={checkAddress}
                  onChange={e => {
                    setCheckAddress(e.target.value);
                    setCheckError(null);
                  }}
                  className="flex-1 h-10 rounded-xl text-[13px] font-mono border-[#EDE9E3]"
                />
                <Input
                  placeholder="Label (optional)"
                  value={checkLabel}
                  onChange={e => setCheckLabel(e.target.value)}
                  className="w-40 h-10 rounded-xl text-[13px] border-[#EDE9E3]"
                />
                <Button
                  onClick={handleCheckContract}
                  disabled={checkLoading || !checkAddress.trim()}
                  className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white"
                >
                  {checkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                </Button>
              </div>
              {checkError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-[#E5484D] shrink-0" />
                  <p className="text-[11px] text-[#E5484D]">{checkError}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#F5F2ED]/60 border border-[#EDE9E3]">
        <Info className="w-4 h-4 text-[#9B9590] shrink-0" />
        <p className="text-[12px] text-[#9B9590] leading-relaxed">
          Approvals are auto-detected from your recent activity. Don&apos;t see one? Use{' '}
          <button
            type="button"
            onClick={() => setCheckOpen(true)}
            className="font-semibold text-[#6B6560] underline underline-offset-2 cursor-pointer"
          >
            Check Contract
          </button>{' '}
          above.
        </p>
      </div>

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
            const isUnknown = !approval.isWatched;
            const isSaving = savingSpender === approval.spender.toLowerCase();

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
                      {isUnknown ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" />
                          {approval.spenderLabel}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-sage bg-sage/10 px-1.5 py-0.5 rounded">
                          {approval.spenderLabel}
                        </span>
                      )}
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

                  {/* Save to watchlist button (unknown spenders only) */}
                  {isUnknown && !isSaving && (
                    <button
                      type="button"
                      onClick={() => {
                        setSavingSpender(approval.spender.toLowerCase());
                        setSaveLabel('');
                      }}
                      className="flex items-center gap-1 text-[12px] font-medium text-[#6B6560] hover:text-sage transition-colors cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      Save
                    </button>
                  )}

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

                {/* Inline save-to-watchlist form */}
                <AnimatePresence>
                  {isSaving && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#EDE9E3]">
                        <Bookmark className="w-3.5 h-3.5 text-sage shrink-0" />
                        <Input
                          placeholder="Label for this spender (optional)"
                          value={saveLabel}
                          onChange={e => setSaveLabel(e.target.value)}
                          className="flex-1 h-8 rounded-lg text-[12px] border-[#EDE9E3]"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleSaveToWatchlist(approval.spender);
                            }
                            if (e.key === 'Escape') {
                              setSavingSpender(null);
                              setSaveLabel('');
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleSaveToWatchlist(approval.spender)}
                          disabled={savingInProgress}
                          className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-sage hover:bg-sage/80 text-white"
                        >
                          {savingInProgress ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setSavingSpender(null);
                            setSaveLabel('');
                          }}
                          className="text-[#9B9590] hover:text-[#6B6560] transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
            No active approvals found. Approvals are created automatically when you use features
            like Recurring Payments, DEX, or Token Management.
          </p>
        </motion.div>
      )}
    </div>
  );
}
