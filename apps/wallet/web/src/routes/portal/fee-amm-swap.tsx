import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  ArrowDownUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';
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
  getAmmCost,
  getAmmOutput,
  getExplorerTxUrl,
  waitForTx,
  type PoolInfo,
} from '@/lib/tempo-client';

interface AmmSwapSearch {
  from?: string;
  to?: string;
}

export const Route = createFileRoute('/portal/fee-amm-swap')({
  component: PoolSwapPage,
  validateSearch: (search: Record<string, unknown>): AmmSwapSearch => ({
    from: typeof search.from === 'string' ? search.from : undefined,
    to: typeof search.to === 'string' ? search.to : undefined,
  }),
});

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type SwapStatus = 'idle' | 'confirming' | 'pending' | 'success';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function PoolSwapPage(): ReactElement | null {
  const { address, ammSwap } = useTempo();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { from, to } = Route.useSearch();
  const navigate = useNavigate();

  // Token selection — validatorToken = what you pay (from), userToken = what you receive (to)
  const [userToken, setUserToken] = useState<Token | null>(null);
  const [validatorToken, setValidatorToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Initialize tokens from URL search params or defaults
  useEffect(() => {
    if (tokens.length < 2 || userToken) return;
    const fromToken = from
      ? tokens.find(t => t.address.toLowerCase() === from.toLowerCase())
      : null;
    const toToken = to ? tokens.find(t => t.address.toLowerCase() === to.toLowerCase()) : null;
    setValidatorToken(fromToken ?? tokens[1]);
    setUserToken(toToken ?? tokens[0]);
  }, [tokens, userToken, from, to]);

  // Fee token priority: user on-chain preference > chain default (AlphaUSD) > first token
  // Re-run whenever preferredFeeToken resolves so we pick up the user's saved preference
  useEffect(() => {
    if (tokens.length === 0) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, preferredFeeToken]);

  // Form state
  const [amountOut, setAmountOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [gasFee, setGasFee] = useState<bigint | null>(null);

  // Track which field the user is actively editing
  const [activeField, setActiveField] = useState<'pay' | 'receive'>('pay');

  // Pool info
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  // Balances
  const { data: validatorBalanceData } = useTokenBalance(validatorToken?.address, address);
  const { data: userBalanceData } = useTokenBalance(userToken?.address, address);

  // Parsed values
  const userDecimals = userToken?.decimals ?? 6;
  const validatorDecimals = validatorToken?.decimals ?? 6;
  const parsedAmountOut = parseAmount(amountOut, userDecimals);
  const parsedAmountIn = parseAmount(amountIn, validatorDecimals);

  // Quote computation — instant, no RPC calls needed.
  // Fee AMM uses fixed rates: amountIn = (amountOut * 10000) / 9985 + 1
  const quotedCost = (() => {
    if (!pool) return null;
    if (activeField === 'receive') {
      return parsedAmountOut > 0n ? getAmmCost(pool, parsedAmountOut) : null;
    }
    // pay direction: compute output first, then its cost
    const out = parsedAmountIn > 0n ? getAmmOutput(pool, parsedAmountIn) : null;
    return out ? getAmmCost(pool, out) : null;
  })();

  const quotedOutput =
    activeField === 'pay' && parsedAmountIn > 0n && pool
      ? getAmmOutput(pool, parsedAmountIn)
      : null;

  const quoteError = (() => {
    if (!pool) return null;
    if (
      activeField === 'receive' &&
      parsedAmountOut > 0n &&
      parsedAmountOut > pool.reserveUserToken
    )
      return 'Amount exceeds pool reserves';
    if (activeField === 'pay' && parsedAmountIn > 0n && !quotedOutput) {
      if (pool.reserveUserToken === 0n) return 'No user token reserves in pool';
      return 'Amount exceeds pool reserves';
    }
    return null;
  })();

  // Effective amounts
  const effectiveAmountOut = activeField === 'pay' ? (quotedOutput ?? 0n) : parsedAmountOut;
  const effectiveCost = quotedCost;

  const hasBalance =
    effectiveCost !== null && effectiveCost > 0n && validatorBalanceData.value >= effectiveCost;

  // Display values — show the user's own input for the active field to avoid
  // confusing rounding artefacts from the roundtrip conversion.
  const displayPayAmount =
    activeField === 'pay' && parsedAmountIn > 0n
      ? formatAmount(parsedAmountIn, validatorDecimals)
      : effectiveCost !== null
        ? formatAmount(effectiveCost, validatorDecimals)
        : '';
  const displayReceiveAmount =
    activeField === 'receive' && parsedAmountOut > 0n
      ? formatAmount(parsedAmountOut, userDecimals)
      : effectiveAmountOut > 0n
        ? formatAmount(effectiveAmountOut, userDecimals)
        : '';

  // Rate string — fixed Fee AMM rate: 1 userToken costs N/SCALE validatorTokens
  // Rebalancers get a ~0.15% bonus (pay less than they receive)
  const rateString =
    effectiveCost !== null && effectiveCost > 0n && effectiveAmountOut > 0n
      ? (9985 / 10000).toFixed(4)
      : null;

  const isValidForm =
    !!userToken &&
    !!validatorToken &&
    !!feeToken &&
    effectiveAmountOut > 0n &&
    hasBalance &&
    userToken.address !== validatorToken.address &&
    pool !== null &&
    status !== 'pending' &&
    status !== 'confirming';

  // Sync token selection to URL
  const updateSearchParams = useCallback(
    (pay: Token | null, receive: Token | null) => {
      navigate({
        to: '/portal/fee-amm-swap',
        search: {
          from: pay?.address,
          to: receive?.address,
        },
        replace: true,
      });
    },
    [navigate]
  );

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

  const handlePayAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmountIn(cleaned);
    setActiveField('pay');
    setAmountOut('');
  }, []);

  const handleReceiveAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmountOut(cleaned);
    setActiveField('receive');
    setAmountIn('');
  }, []);

  const handleSetMaxPay = useCallback(() => {
    if (!validatorBalanceData.value || !validatorToken) return;
    const balance = validatorBalanceData.value;
    setAmountIn(formatAmount(balance, validatorDecimals, validatorDecimals));
    setActiveField('pay');
    setAmountOut('');
  }, [validatorBalanceData.value, validatorToken, validatorDecimals]);

  const handleSwapTokenPositions = useCallback(() => {
    const prevUser = userToken;
    const prevValidator = validatorToken;
    setUserToken(prevValidator);
    setValidatorToken(prevUser);
    setAmountIn('');
    setAmountOut('');
    setPool(null);
    setPoolError(null);
    setTxHash(null);
    updateSearchParams(prevUser, prevValidator);
  }, [userToken, validatorToken, updateSearchParams]);

  const handleUserTokenChange = useCallback(
    (t: Token) => {
      const newValidator =
        validatorToken && t.address === validatorToken.address ? userToken : validatorToken;
      if (validatorToken && t.address === validatorToken.address) {
        setValidatorToken(userToken);
      }
      setUserToken(t);
      setPool(null);
      setPoolError(null);
      setTxHash(null);
      updateSearchParams(newValidator, t);
    },
    [userToken, validatorToken, updateSearchParams]
  );

  const handleValidatorTokenChange = useCallback(
    (t: Token) => {
      const newUser = userToken && t.address === userToken.address ? validatorToken : userToken;
      if (userToken && t.address === userToken.address) {
        setUserToken(validatorToken);
      }
      setValidatorToken(t);
      setPool(null);
      setPoolError(null);
      setTxHash(null);
      updateSearchParams(t, newUser);
    },
    [userToken, validatorToken, updateSearchParams]
  );

  const handleSwap = useCallback(async () => {
    if (!userToken || !validatorToken || !feeToken || effectiveAmountOut === 0n) return;

    setStatus('pending');
    try {
      const hash = await ammSwap({
        userToken: userToken.address,
        validatorToken: validatorToken.address,
        amountOut: effectiveAmountOut,
        feeToken: feeToken.address,
      });
      const receipt = await waitForTx(hash as `0x${string}`);
      setGasFee(receipt.gasUsed * receipt.effectiveGasPrice);
      setTxHash(hash);
      setStatus('success');
      fetchPool();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Swap failed', {
        description: message.length > 120 ? 'Please try again.' : message,
      });
      setStatus('idle');
    }
  }, [userToken, validatorToken, feeToken, effectiveAmountOut, ammSwap, fetchPool]);

  const handleReset = useCallback(() => {
    setAmountIn('');
    setAmountOut('');
    setTxHash(null);
    setGasFee(null);
    setStatus('idle');
    setPoolError(null);
  }, []);

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
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Fee AMM Swap</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">Swap tokens using Fee AMM liquidity pools</p>
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
      {/* Main content */}
      {userToken && validatorToken && feeToken && (
        <AnimatePresence mode="wait">
          {/* ============================================================= */}
          {/* SUCCESS STATE                                                  */}
          {/* ============================================================= */}
          {status === 'success' && txHash ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
            >
              {/* Success header */}
              <div className="px-6 pt-8 pb-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-[#5B9A6F] flex items-center justify-center mx-auto mb-5"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-[17px] font-bold text-[#2D3436] mb-1"
                >
                  Swap Successful
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center justify-center gap-2 text-[#6B6560] text-[14px]"
                >
                  <span className="font-semibold text-[#2D3436]">{displayPayAmount}</span>
                  <span>{validatorToken.symbol}</span>
                  <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                  <span className="font-semibold text-[#2D3436]">{displayReceiveAmount}</span>
                  <span>{userToken.symbol}</span>
                </motion.div>
              </div>

              {/* Details */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mx-6 mb-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 space-y-3"
              >
                {rateString && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Rate</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      1 {userToken.symbol} = {rateString} {validatorToken.symbol}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9B9590]">Bonus (0.15%)</span>
                  <span className="text-[12px] font-medium text-[#5B9A6F]">
                    {effectiveCost !== null && effectiveAmountOut > effectiveCost
                      ? `+${formatAmount(effectiveAmountOut - effectiveCost, userDecimals)} ${userToken.symbol}`
                      : '—'}
                  </span>
                </div>
                {gasFee !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9B9590]">Network Fee</span>
                    <span className="text-[12px] font-medium text-[#2D3436]">
                      {formatAmount(gasFee, 18)} {feeToken.symbol}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9B9590]">Transaction</span>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] font-mono text-[#E07A5F] hover:text-[#C45A3F] transition-colors"
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="px-6 pb-6"
              >
                <Button
                  onClick={handleReset}
                  className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
                >
                  New Swap
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            /* ============================================================= */
            /* FORM STATE (idle / confirming / pending)                       */
            /* ============================================================= */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                className="p-5"
              >
                {/* You Pay */}
                <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      You Pay
                    </span>
                    <button
                      type="button"
                      onClick={handleSetMaxPay}
                      className="text-[11px] text-[#9B9590] hover:text-[#E07A5F] transition-colors"
                    >
                      Balance: {formatAmount(validatorBalanceData.value, validatorDecimals)}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={
                        activeField === 'pay'
                          ? amountIn
                          : quotedCost !== null
                            ? formatAmount(quotedCost, validatorDecimals)
                            : ''
                      }
                      onChange={e => handlePayAmountChange(e.target.value)}
                      disabled={status !== 'idle'}
                      className="flex-1 text-[28px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                    />
                    <TokenPicker
                      token={validatorToken}
                      tokens={tokens}
                      disabledAddresses={[userToken.address]}
                      onChange={handleValidatorTokenChange}
                    />
                  </div>
                  {!hasBalance && effectiveCost !== null && effectiveAmountOut > 0n && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Insufficient balance</span>
                    </motion.div>
                  )}
                </div>

                {/* Direction Toggle */}
                <div className="flex justify-center -my-2.5 relative z-10">
                  <motion.button
                    whileHover={{ rotate: 180, scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    onClick={handleSwapTokenPositions}
                    disabled={status !== 'idle'}
                    className="w-10 h-10 rounded-xl bg-white border border-[#EDE9E3] flex items-center justify-center shadow-sm hover:border-[#E07A5F]/30 transition-colors"
                  >
                    <ArrowDownUp className="w-4 h-4 text-[#6B6560]" />
                  </motion.button>
                </div>

                {/* You Receive */}
                <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      You Receive
                    </span>
                    <span className="text-[11px] text-[#9B9590]">
                      Balance: {formatAmount(userBalanceData.value, userDecimals)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={
                        activeField === 'receive'
                          ? amountOut
                          : quotedOutput !== null
                            ? formatAmount(quotedOutput, userDecimals)
                            : ''
                      }
                      onChange={e => handleReceiveAmountChange(e.target.value)}
                      disabled={status !== 'idle'}
                      className="flex-1 text-[28px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                    />
                    <TokenPicker
                      token={userToken}
                      tokens={tokens}
                      disabledAddresses={[validatorToken.address]}
                      onChange={handleUserTokenChange}
                    />
                  </div>

                  {/* Pool loading */}
                  {isLoadingPool && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9B9590]"
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Loading pool...</span>
                    </motion.div>
                  )}

                  {/* Pool / quote error */}
                  {(poolError || quoteError) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>{poolError || quoteError}</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
              {/* Quote Details */}
              <AnimatePresence>
                {effectiveAmountOut > 0n && effectiveCost !== null && pool && !poolError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 overflow-hidden"
                  >
                    <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 mb-4 space-y-2.5">
                      {rateString && (
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#9B9590]">Rate</span>
                          <span className="text-[12px] font-medium text-[#2D3436]">
                            1 {userToken.symbol} = {rateString} {validatorToken.symbol}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Bonus (0.15%)</span>
                        <span className="text-[12px] font-medium text-[#5B9A6F]">
                          +{formatAmount(effectiveAmountOut - effectiveCost, userDecimals)}{' '}
                          {userToken.symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Pool Reserves</span>
                        <span className="text-[12px] font-medium text-[#2D3436]">
                          {formatAmount(pool.reserveUserToken, userDecimals)} {userToken.symbol}
                          {' / '}
                          {formatAmount(pool.reserveValidatorToken, validatorDecimals)}{' '}
                          {validatorToken.symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Network Fee</span>
                        <span className="text-[12px] font-medium text-[#9B9590]">
                          Paid in {feeToken.symbol}
                        </span>
                      </div>
                      <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Action Buttons */}
              <div className="px-5 pb-5">
                {status === 'idle' && (
                  <Button
                    onClick={() => setStatus('confirming')}
                    disabled={!isValidForm}
                    className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA]"
                  >
                    {isLoadingPool ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                        Loading pool...
                      </>
                    ) : poolError ? (
                      'No Pool Available'
                    ) : (
                        activeField === 'pay'
                          ? !amountIn || parsedAmountIn === 0n
                          : !amountOut || parsedAmountOut === 0n
                      ) ? (
                      'Enter an amount'
                    ) : quoteError ? (
                      quoteError
                    ) : effectiveCost === null && effectiveAmountOut > 0n ? (
                      'Amount exceeds reserves'
                    ) : !hasBalance ? (
                      `Insufficient ${validatorToken.symbol} balance`
                    ) : (
                      'Review Swap'
                    )}
                  </Button>
                )}

                {status === 'confirming' && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Confirmation summary */}
                    <div className="rounded-xl border border-[#E07A5F]/20 bg-[#E07A5F]/[0.04] p-4">
                      <p className="text-[12px] font-semibold text-[#E07A5F] uppercase tracking-wider mb-2">
                        Confirm Swap
                      </p>
                      <div className="flex items-center gap-3 text-[14px]">
                        <span className="font-bold text-[#2D3436]">{displayPayAmount}</span>
                        <span className="text-[#6B6560]">{validatorToken.symbol}</span>
                        <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                        <span className="font-bold text-[#2D3436]">{displayReceiveAmount}</span>
                        <span className="text-[#6B6560]">{userToken.symbol}</span>
                      </div>
                      {rateString && (
                        <p className="text-[11px] text-[#9B9590] mt-2">
                          Rate: 1 {userToken.symbol} = {rateString} {validatorToken.symbol}
                        </p>
                      )}
                      <p className="text-[11px] text-[#9B9590] mt-1">
                        Network fee paid in {feeToken.symbol}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => setStatus('idle')}
                        variant="outline"
                        className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSwap}
                        className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
                      >
                        Confirm Swap
                      </Button>
                    </div>
                  </motion.div>
                )}

                {status === 'pending' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-6 text-center"
                  >
                    <div className="relative inline-flex items-center justify-center mb-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                        className="absolute w-16 h-16"
                      >
                        <svg viewBox="0 0 64 64" className="w-full h-full">
                          <circle
                            cx="32"
                            cy="32"
                            r="30"
                            fill="none"
                            stroke="url(#ammSwapGrad)"
                            strokeWidth="1.5"
                            strokeDasharray="50 140"
                            strokeLinecap="round"
                          />
                          <defs>
                            <linearGradient id="ammSwapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.7" />
                              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.1" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </motion.div>
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-11 h-11 rounded-full bg-[#E07A5F]/10 flex items-center justify-center"
                      >
                        <Loader2 className="w-5 h-5 text-[#E07A5F] animate-spin" />
                      </motion.div>
                    </div>
                    <p className="text-[13px] font-semibold text-[#2D3436]">Processing Swap</p>
                    <p className="text-[12px] text-[#9B9590] mt-1">
                      Swapping {displayPayAmount} {validatorToken.symbol} for ~
                      {displayReceiveAmount} {userToken.symbol}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
