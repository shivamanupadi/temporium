import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldOff, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useApprovals, type ApprovalEntry } from '@/hooks/useApprovals';
import type { Token } from '@/lib/tokenlist';
import { tempoChain } from '@/lib/tempo-client';
import { formatAmount, formatAddress, cn } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/approvals')({
  component: ApprovalsPage,
});

function ApprovalsPage(): ReactElement | null {
  const { address, isConnected, approveToken } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { approvals, isLoading, refresh } = useApprovals();

  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  useEffect(() => {
    if (tokens.length === 0 || feeToken) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, feeToken, preferredFeeToken]);

  const handleRevoke = useCallback(
    async (approval: ApprovalEntry) => {
      if (!feeToken || revokingKey) return;
      const key = `${approval.token.address}-${approval.spender}`;
      setRevokingKey(key);
      try {
        await approveToken({
          token: approval.token.address,
          spender: approval.spender,
          amount: 0n,
          feeToken: feeToken.address,
        });
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
    [feeToken, revokingKey, approveToken, refresh]
  );

  if (!isConnected || !address) return null;

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Token Approvals</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">Manage your token spending allowances</p>
        </div>
        <button
          onClick={refresh}
          className="p-2 rounded-xl border border-[#EDE9E3] text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Fee token picker */}
      {feeToken && tokens.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5 mb-4"
        >
          <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
        </motion.div>
      )}

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
                    disabled={isRevoking || !feeToken}
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-12 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-[#059669]" />
          </div>
          <p className="text-[15px] font-semibold text-[#2D3436] mb-1">No Active Approvals</p>
          <p className="text-[13px] text-[#9B9590]">
            You haven&apos;t granted any token spending allowances
          </p>
        </motion.div>
      )}
    </div>
  );
}
