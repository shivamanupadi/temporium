import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, ExternalLink, AlertTriangle, Info } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';
import { tempoChain } from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';
import {
  getPoolInfo,
  estimateAmmCost,
  getExplorerTxUrl,
  waitForTx,
  type PoolInfo,
} from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/pool-swap')({
  component: PoolSwapPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function PoolSwapPage(): ReactElement | null {
  const { address, ammSwap } = useTempo();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  // Token selection — userToken = what you receive, validatorToken = what you pay
  const [userToken, setUserToken] = useState<Token | null>(null);
  const [validatorToken, setValidatorToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  useEffect(() => {
    if (tokens.length >= 2 && !userToken) {
      setUserToken(tokens[0]);
      setValidatorToken(tokens[1]);
    }
  }, [tokens, userToken]);

  // Fee token priority: user on-chain preference > chain default (AlphaUSD) > first token
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

  // Form state
  const [amountOut, setAmountOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Pool info
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  // Balances
  const { data: validatorBalanceData } = useTokenBalance(validatorToken?.address, address);

  // Parsed values
  const userDecimals = userToken?.decimals ?? 6;
  const validatorDecimals = validatorToken?.decimals ?? 6;
  const parsedAmountOut = parseAmount(amountOut, userDecimals);

  // Estimated cost
  const estimatedCost =
    pool && parsedAmountOut > 0n ? estimateAmmCost(pool, parsedAmountOut) : null;

  const hasBalance = estimatedCost !== null && validatorBalanceData.value >= estimatedCost;

  const isValidForm =
    !!userToken &&
    !!validatorToken &&
    !!feeToken &&
    parsedAmountOut > 0n &&
    estimatedCost !== null &&
    hasBalance &&
    userToken.address !== validatorToken.address &&
    pool !== null &&
    !isSubmitting;

  // ---------------------------------------------------------------------------
  // Fetch pool
  // ---------------------------------------------------------------------------

  const fetchPool = useCallback(async () => {
    if (!userToken || !validatorToken || userToken.address === validatorToken.address) {
      setPool(null);
      setPoolError(null);
      return;
    }
    setIsLoadingPool(true);
    setPoolError(null);
    try {
      const info = await getPoolInfo(userToken.address, validatorToken.address);
      setPool(info);
      if (!info || (info.reserveUserToken === 0n && info.reserveValidatorToken === 0n)) {
        setPoolError('No liquidity pool exists for this pair');
      }
    } catch {
      setPool(null);
      setPoolError('Failed to fetch pool info');
    } finally {
      setIsLoadingPool(false);
    }
  }, [userToken, validatorToken]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  useEffect(() => {
    if (!userToken || !validatorToken) return;
    const interval = setInterval(fetchPool, TIMING.POOL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [userToken, validatorToken, fetchPool]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmountOut(cleaned);
  }, []);

  const handleSetMax = useCallback(() => {
    if (!pool || !validatorBalanceData.value || !validatorToken) return;
    // Calculate max amountOut from user's validatorToken balance
    // amountOut = (Ru * amountIn) / (Rv + amountIn)
    const balance = validatorBalanceData.value;
    const maxOut = (pool.reserveUserToken * balance) / (pool.reserveValidatorToken + balance);
    if (maxOut > 0n) {
      setAmountOut(formatAmount(maxOut, userToken?.decimals ?? 6, userToken?.decimals ?? 6));
    }
  }, [pool, validatorBalanceData.value, validatorToken, userToken]);

  const handleUserTokenChange = useCallback(
    (t: Token) => {
      if (validatorToken && t.address === validatorToken.address) {
        setValidatorToken(userToken);
      }
      setUserToken(t);
      setPool(null);
      setPoolError(null);
      setTxHash(null);
    },
    [userToken, validatorToken]
  );

  const handleValidatorTokenChange = useCallback(
    (t: Token) => {
      if (userToken && t.address === userToken.address) {
        setUserToken(validatorToken);
      }
      setValidatorToken(t);
      setPool(null);
      setPoolError(null);
      setTxHash(null);
    },
    [userToken, validatorToken]
  );

  const handleSwap = useCallback(async () => {
    if (!isValidForm || !userToken || !validatorToken || !feeToken) return;

    setIsSubmitting(true);
    setTxHash(null);
    try {
      const hash = await ammSwap({
        userToken: userToken.address,
        validatorToken: validatorToken.address,
        amountOut: parsedAmountOut,
        feeToken: feeToken.address,
      });
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash);
      setAmountOut('');
      toast.success('Pool swap complete', {
        description: `Received ${formatAmount(parsedAmountOut, userDecimals)} ${userToken.symbol}`,
      });
      fetchPool();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Swap failed', {
        description: message.length > 120 ? 'Please try again.' : message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidForm,
    userToken,
    validatorToken,
    feeToken,
    parsedAmountOut,
    userDecimals,
    ammSwap,
    fetchPool,
  ]);

  if (!address) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-md">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Pool Swap</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">Swap tokens using AMM liquidity pools</p>
      </motion.div>

      {/* Loading state */}
      {(!userToken || !validatorToken || !feeToken) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-2xl border border-[#EDE9E3] bg-white p-8 text-center"
        >
          {isLoadingTokens ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#9B9590]" />
              <span className="text-[13px] text-[#9B9590]">Loading tokens...</span>
            </div>
          ) : (
            <p className="text-[13px] text-[#9B9590]">No tokens available.</p>
          )}
        </motion.div>
      )}

      {/* Main card */}
      {userToken && validatorToken && feeToken && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
        >
          <div className="p-4 space-y-3">
            {/* You Receive */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  You Receive
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountOut}
                  onChange={e => handleAmountChange(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 text-[22px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                />
                <TokenPicker
                  token={userToken}
                  tokens={tokens}
                  disabledAddresses={[validatorToken.address]}
                  onChange={handleUserTokenChange}
                />
              </div>
            </div>

            {/* You Pay (estimated) */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  You Pay (estimated)
                </span>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[10px] text-[#9B9590] hover:text-[#6B6560] transition-colors"
                >
                  Bal: {formatAmount(validatorBalanceData.value, validatorDecimals)}{' '}
                  {validatorToken.symbol}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {isLoadingPool ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#9B9590]" />
                      <span className="text-[14px] text-[#9B9590]">Loading pool...</span>
                    </div>
                  ) : estimatedCost !== null ? (
                    <p className="text-[22px] font-bold text-[#2D3436]">
                      {formatAmount(estimatedCost, validatorDecimals)}
                    </p>
                  ) : parsedAmountOut > 0n && pool ? (
                    <p className="text-[16px] text-[#D35D3A] font-medium">Exceeds pool reserves</p>
                  ) : (
                    <p className="text-[22px] font-bold text-[#D5D0CA]">–</p>
                  )}
                </div>
                <TokenPicker
                  token={validatorToken}
                  tokens={tokens}
                  disabledAddresses={[userToken.address]}
                  onChange={handleValidatorTokenChange}
                />
              </div>
              {estimatedCost !== null && !hasBalance && parsedAmountOut > 0n && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#D35D3A]">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient {validatorToken.symbol} balance
                </p>
              )}
            </div>

            {/* Pool Info */}
            {pool && pool.reserveUserToken > 0n && (
              <div className="flex items-start gap-2 px-1 py-1.5">
                <Info className="w-3.5 h-3.5 text-[#B5B0AA] mt-0.5 shrink-0" />
                <div className="text-[11px] text-[#9B9590] space-y-0.5">
                  <p>
                    Pool: {formatAmount(pool.reserveUserToken, userToken.decimals)}{' '}
                    {userToken.symbol}
                    {' / '}
                    {formatAmount(pool.reserveValidatorToken, validatorToken.decimals)}{' '}
                    {validatorToken.symbol}
                  </p>
                  {estimatedCost !== null && parsedAmountOut > 0n && (
                    <p>
                      Rate: 1 {userToken.symbol} ≈{' '}
                      {formatAmount(
                        (pool.reserveValidatorToken * 10n ** BigInt(userToken.decimals)) /
                          pool.reserveUserToken,
                        validatorToken.decimals
                      )}{' '}
                      {validatorToken.symbol}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pool error */}
            {poolError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/50">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <p className="text-[12px] text-amber-700">{poolError}</p>
              </div>
            )}

            {/* Fee token */}
            <div className="flex items-center justify-between px-1">
              <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSwap}
              disabled={!isValidForm}
              className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#9B72CF] hover:bg-[#8660B8] text-white disabled:opacity-100 disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Swapping...
                </>
              ) : poolError ? (
                'No pool available'
              ) : !amountOut || parsedAmountOut === 0n ? (
                'Enter an amount'
              ) : estimatedCost === null && parsedAmountOut > 0n ? (
                'Amount exceeds reserves'
              ) : !hasBalance ? (
                `Insufficient ${validatorToken.symbol} balance`
              ) : (
                'Swap'
              )}
            </Button>

            {/* Transaction Success */}
            <AnimatePresence>
              {txHash && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#5B9A6F]/20 bg-[#5B9A6F]/5"
                >
                  <CheckCircle className="w-4 h-4 shrink-0 text-[#5B9A6F]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#2D3436]">Swap complete</p>
                    <p className="text-[11px] text-[#6B6560] font-mono truncate">{txHash}</p>
                  </div>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#5B9A6F] shrink-0"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
