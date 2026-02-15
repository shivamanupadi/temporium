import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
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
import { getSwapQuote, getExplorerTxUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/swap')({
  component: SwapPage,
});

// ---------------------------------------------------------------------------
// Swap status
// ---------------------------------------------------------------------------

type SwapStatus = 'idle' | 'confirming' | 'pending' | 'success';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeImpliedPrice(amountInStr: string, amountOutStr: string): string {
  const inNum = Number(amountInStr);
  const outNum = Number(amountOutStr);
  if (!inNum || !outNum || !Number.isFinite(outNum / inNum)) return '–';
  return (outNum / inNum).toFixed(6);
}

// ---------------------------------------------------------------------------
// Swap Page
// ---------------------------------------------------------------------------

function SwapPage(): ReactElement | null {
  const { address, swapTokens } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  // Token selection state (default to first two tokens from tokenlist)
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  useEffect(() => {
    if (tokens.length > 0 && !tokenIn) setTokenIn(tokens[0]);
    if (tokens.length > 1 && !tokenOut) setTokenOut(tokens[1]);
  }, [tokens, tokenIn, tokenOut]);

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
  const [amountIn, setAmountIn] = useState('');
  const [quoteOut, setQuoteOut] = useState('');
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [slippage] = useState(0.5);

  // Balances
  const { data: balanceInData, isLoading: isBalanceInLoading } = useTokenBalance(
    tokenIn?.address,
    address
  );
  const { data: balanceOutData, isLoading: isBalanceOutLoading } = useTokenBalance(
    tokenOut?.address,
    address
  );

  // Parsed amounts
  const tokenInDecimals = tokenIn?.decimals ?? 6;
  const tokenOutDecimals = tokenOut?.decimals ?? 6;
  const parsedAmountIn = parseAmount(amountIn, tokenInDecimals);
  const parsedQuoteOut = parseAmount(quoteOut, tokenOutDecimals);
  const minAmountOut =
    parsedQuoteOut - (parsedQuoteOut * BigInt(Math.floor(slippage * 100))) / 10000n;
  const hasBalance = balanceInData.value >= parsedAmountIn;
  const noLiquidity = amountIn !== '' && parsedAmountIn > 0n && !isQuoting && quoteOut === '0.00';

  const isValidForm =
    !!tokenIn &&
    !!tokenOut &&
    !!feeToken &&
    parsedAmountIn > 0n &&
    parsedQuoteOut > 0n &&
    hasBalance &&
    tokenIn.address !== tokenOut.address &&
    !noLiquidity &&
    !isQuoting &&
    !quoteError;

  // -------------------------------------------------------------------------
  // Debounced quote fetch
  // -------------------------------------------------------------------------

  useEffect(() => {
    setQuoteError(null);

    if (!amountIn || parsedAmountIn === 0n || !tokenIn || !tokenOut) {
      setQuoteOut('');
      return;
    }

    let cancelled = false;
    setIsQuoting(true);

    const timeout = setTimeout(async () => {
      try {
        const quote = await getSwapQuote(tokenIn.address, tokenOut.address, parsedAmountIn);
        if (!cancelled) {
          setQuoteOut(formatAmount(quote.toString(), tokenOutDecimals));
        }
      } catch (err) {
        console.error('Quote fetch failed:', err);
        if (!cancelled) {
          setQuoteOut('');
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('0xaa4bc69a')) {
            setQuoteError('Trading pair not created. No orderbook exists.');
          } else if (msg.includes('0x13be252b') || msg.includes('InsufficientLiquidity')) {
            setQuoteError('No liquidity available for this pair');
          } else if (msg.includes('revert') || msg.includes('execution reverted')) {
            setQuoteError('This trading pair is not available');
          } else {
            setQuoteError('Unable to fetch quote. Check your connection.');
          }
        }
      } finally {
        if (!cancelled) {
          setIsQuoting(false);
        }
      }
    }, TIMING.DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [amountIn, tokenIn, tokenOut, parsedAmountIn, tokenOutDecimals]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleAmountChange = useCallback((value: string): void => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Only allow a single decimal point
    if (cleaned.split('.').length > 2) return;
    setAmountIn(cleaned);
  }, []);

  const handleSetMax = useCallback((): void => {
    if (balanceInData.value > 0n) {
      setAmountIn(formatAmount(balanceInData.value, tokenInDecimals, tokenInDecimals));
    }
  }, [balanceInData.value, tokenInDecimals]);

  const handleFlipTokens = useCallback((): void => {
    const prevIn = tokenIn;
    const prevOut = tokenOut;
    const prevAmountOut = quoteOut;
    setTokenIn(prevOut);
    setTokenOut(prevIn);
    setAmountIn(prevAmountOut);
    setQuoteOut('');
  }, [tokenIn, tokenOut, quoteOut]);

  const handleTokenInChange = useCallback(
    (t: Token): void => {
      if (tokenOut && t.address === tokenOut.address) {
        setTokenOut(tokenIn);
      }
      setTokenIn(t);
      setQuoteOut('');
    },
    [tokenIn, tokenOut]
  );

  const handleTokenOutChange = useCallback(
    (t: Token): void => {
      if (tokenIn && t.address === tokenIn.address) {
        setTokenIn(tokenOut);
      }
      setTokenOut(t);
      setQuoteOut('');
    },
    [tokenIn, tokenOut]
  );

  const handleSwap = useCallback(async (): Promise<void> => {
    if (!isValidForm || !tokenIn || !tokenOut || !feeToken) return;

    setStatus('pending');
    try {
      const hash = await swapTokens({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
        minAmountOut,
        feeToken: feeToken.address,
      });
      setTxHash(hash);
      setStatus('success');
    } catch (err) {
      console.error('Swap failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes('0xaa4bc69a') ||
        message.includes('0x13be252b') ||
        message.includes('InsufficientLiquidity')
      ) {
        toast.error('No liquidity available', {
          description: 'This trading pair has no orders on testnet. Place limit orders first.',
        });
      } else {
        toast.error('Swap failed', {
          description: message.length > 120 ? 'Please try again or check explorer.' : message,
        });
      }
      setStatus('idle');
    }
  }, [isValidForm, swapTokens, tokenIn, tokenOut, feeToken, parsedAmountIn, minAmountOut]);

  const handleReset = useCallback((): void => {
    setAmountIn('');
    setQuoteOut('');
    setTxHash(null);
    setStatus('idle');
    setQuoteError(null);
  }, []);

  if (!address || !tokenIn || !tokenOut || !feeToken) return null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Swap</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">Exchange tokens instantly</p>
      </motion.div>

      {/* Success State */}
      <AnimatePresence mode="wait">
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
                <span className="font-semibold text-[#2D3436]">{amountIn}</span>
                <span>{tokenIn.symbol}</span>
                <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                <span className="font-semibold text-[#2D3436]">{quoteOut}</span>
                <span>{tokenOut.symbol}</span>
              </motion.div>
            </div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mx-6 mb-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Rate</span>
                <span className="text-[12px] font-medium text-[#2D3436]">
                  1 {tokenIn.symbol} = {computeImpliedPrice(amountIn, quoteOut)} {tokenOut.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Transaction</span>
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] font-mono text-[#9B72CF] hover:text-[#7E5BB0] transition-colors"
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
                className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#9B72CF] hover:bg-[#8660B8] text-white"
              >
                New Swap
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          /* Swap Form */
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
          >
            {/* Token In */}
            <motion.div variants={itemVariants} className="p-5">
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    You Pay
                  </span>
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="text-[11px] text-[#9B9590] hover:text-[#9B72CF] transition-colors"
                  >
                    Balance:{' '}
                    {isBalanceInLoading
                      ? '...'
                      : formatAmount(balanceInData.value, tokenInDecimals)}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountIn}
                    onChange={e => handleAmountChange(e.target.value)}
                    disabled={status === 'pending'}
                    className="flex-1 text-[28px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                  />
                  <TokenPicker
                    token={tokenIn}
                    tokens={tokens}
                    disabledAddresses={[tokenOut.address]}
                    onChange={handleTokenInChange}
                  />
                </div>

                {/* Insufficient balance warning */}
                {amountIn && parsedAmountIn > 0n && !hasBalance && (
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
                  onClick={handleFlipTokens}
                  disabled={status === 'pending'}
                  className="w-10 h-10 rounded-xl bg-white border border-[#EDE9E3] flex items-center justify-center shadow-sm hover:border-[#9B72CF]/30 transition-colors"
                >
                  <ArrowDown className="w-4 h-4 text-[#6B6560]" />
                </motion.button>
              </div>

              {/* Token Out */}
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    You Receive
                  </span>
                  <span className="text-[11px] text-[#9B9590]">
                    Balance:{' '}
                    {isBalanceOutLoading
                      ? '...'
                      : formatAmount(balanceOutData.value, tokenOutDecimals)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 flex items-center">
                    {isQuoting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-[#9B72CF] animate-spin" />
                        <span className="text-[14px] text-[#9B9590]">Fetching quote...</span>
                      </div>
                    ) : (
                      <span
                        className={`text-[28px] font-bold ${
                          quoteOut && quoteOut !== '0.00' ? 'text-[#2D3436]' : 'text-[#D5D0CA]'
                        }`}
                      >
                        {quoteOut || '0.00'}
                      </span>
                    )}
                  </div>
                  <TokenPicker
                    token={tokenOut}
                    tokens={tokens}
                    disabledAddresses={[tokenIn.address]}
                    onChange={handleTokenOutChange}
                  />
                </div>

                {/* No liquidity warning */}
                {noLiquidity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-600"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>No liquidity available for this pair on testnet</span>
                  </motion.div>
                )}

                {/* Quote error */}
                {quoteError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{quoteError}</span>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Quote Details & Slippage */}
            <AnimatePresence>
              {parsedAmountIn > 0n && parsedQuoteOut > 0n && !noLiquidity && !quoteError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-5 overflow-hidden"
                >
                  <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 mb-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">Rate</span>
                      <span className="text-[12px] font-medium text-[#2D3436]">
                        1 {tokenIn.symbol} = {computeImpliedPrice(amountIn, quoteOut)}{' '}
                        {tokenOut.symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">Slippage Tolerance</span>
                      <span className="text-[12px] font-medium text-[#2D3436]">{slippage}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#9B9590]">Minimum Received</span>
                      <span className="text-[12px] font-medium text-[#2D3436]">
                        {formatAmount(minAmountOut, tokenOutDecimals)} {tokenOut.symbol}
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
                  className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#9B72CF] hover:bg-[#8660B8] text-white disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA]"
                >
                  {isQuoting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                      Getting quote...
                    </>
                  ) : noLiquidity ? (
                    'No Liquidity'
                  ) : !amountIn || parsedAmountIn === 0n ? (
                    'Enter an amount'
                  ) : !hasBalance ? (
                    'Insufficient balance'
                  ) : quoteError ? (
                    'Quote unavailable'
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
                  <div className="rounded-xl border border-[#9B72CF]/20 bg-[#9B72CF]/[0.04] p-4">
                    <p className="text-[12px] font-semibold text-[#9B72CF] uppercase tracking-wider mb-2">
                      Confirm Swap
                    </p>
                    <div className="flex items-center gap-3 text-[14px]">
                      <span className="font-bold text-[#2D3436]">{amountIn}</span>
                      <span className="text-[#6B6560]">{tokenIn.symbol}</span>
                      <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                      <span className="font-bold text-[#2D3436]">{quoteOut}</span>
                      <span className="text-[#6B6560]">{tokenOut.symbol}</span>
                    </div>
                    <p className="text-[11px] text-[#9B9590] mt-2">
                      Min. received: {formatAmount(minAmountOut, tokenOutDecimals)}{' '}
                      {tokenOut.symbol} (slippage: {slippage}%)
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
                      className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#9B72CF] hover:bg-[#8660B8] text-white"
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
                    {/* Spinning ring */}
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
                          stroke="url(#swapGrad)"
                          strokeWidth="1.5"
                          strokeDasharray="50 140"
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="swapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#9B72CF" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="#9B72CF" stopOpacity="0.1" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-11 h-11 rounded-full bg-[#9B72CF]/10 flex items-center justify-center"
                    >
                      <Loader2 className="w-5 h-5 text-[#9B72CF] animate-spin" />
                    </motion.div>
                  </div>
                  <p className="text-[13px] font-semibold text-[#2D3436]">Processing Swap</p>
                  <p className="text-[12px] text-[#9B9590] mt-1">
                    Swapping {amountIn} {tokenIn.symbol} for ~{quoteOut} {tokenOut.symbol}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
