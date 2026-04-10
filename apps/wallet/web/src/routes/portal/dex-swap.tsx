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
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useWalletClient } from 'wagmi';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import type { Token } from '@/lib/tokenlist';
import { tempoChain, tempoPublicClient, getExplorerTxUrl, waitForTx, Actions } from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';

interface DexSwapSearch {
  from?: string;
  to?: string;
}

export const Route = createFileRoute('/portal/dex-swap')({
  component: DexSwapPage,
  validateSearch: (search: Record<string, unknown>): DexSwapSearch => ({
    from: typeof search.from === 'string' ? search.from : undefined,
    to: typeof search.to === 'string' ? search.to : undefined,
  }),
});

type SwapStatus = 'idle' | 'quoting' | 'confirming' | 'pending' | 'success';

function DexSwapPage(): ReactElement | null {
  const { address } = useTempo();
  const { data: walletClient } = useWalletClient();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { from, to } = Route.useSearch();
  const navigate = useNavigate();

  // Token selection
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Initialize tokens from URL or defaults
  useEffect(() => {
    if (tokens.length < 2 || tokenIn) return;
    const fromToken = from
      ? tokens.find(t => t.address.toLowerCase() === from.toLowerCase())
      : null;
    const toToken = to
      ? tokens.find(t => t.address.toLowerCase() === to.toLowerCase())
      : null;
    setTokenIn(fromToken ?? tokens[0]);
    setTokenOut(toToken ?? tokens[1]);
  }, [tokens, tokenIn, from, to]);

  // Fee token preference
  useEffect(() => {
    if (tokens.length === 0 || feeToken) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, preferredFeeToken, feeToken]);

  // Form state
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState<bigint | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [gasFee, setGasFee] = useState<bigint | null>(null);

  // Balances
  const { data: tokenInBalance } = useTokenBalance(tokenIn?.address, address);
  const { data: tokenOutBalance } = useTokenBalance(tokenOut?.address, address);

  const inDecimals = tokenIn?.decimals ?? 6;
  const outDecimals = tokenOut?.decimals ?? 6;
  const parsedAmountIn = parseAmount(amountIn, inDecimals);

  const hasBalance = parsedAmountIn > 0n && tokenInBalance.value >= parsedAmountIn;

  const isValidForm =
    !!tokenIn &&
    !!tokenOut &&
    !!feeToken &&
    parsedAmountIn > 0n &&
    quote !== null &&
    quote > 0n &&
    hasBalance &&
    tokenIn.address !== tokenOut.address &&
    status !== 'pending' &&
    status !== 'confirming';

  // Sync token selection to URL
  const updateSearchParams = useCallback(
    (pay: Token | null, receive: Token | null) => {
      navigate({
        to: '/portal/dex-swap',
        search: { from: pay?.address, to: receive?.address },
        replace: true,
      });
    },
    [navigate]
  );

  // Fetch quote from on-chain
  useEffect(() => {
    if (!tokenIn || !tokenOut || parsedAmountIn <= 0n || tokenIn.address === tokenOut.address) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setIsQuoting(true);

    Actions.dex
      .getSellQuote(tempoPublicClient, {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
      })
      .then(result => {
        if (!cancelled) setQuote(result);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setIsQuoting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenIn, tokenOut, parsedAmountIn]);

  // Handlers
  const handleAmountInChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmountIn(cleaned);
  }, []);

  const handleSetMax = useCallback(() => {
    if (!tokenInBalance.value || !tokenIn) return;
    setAmountIn(formatAmount(tokenInBalance.value, inDecimals, inDecimals));
  }, [tokenInBalance.value, tokenIn, inDecimals]);

  const handleSwapTokenPositions = useCallback(() => {
    const prevIn = tokenIn;
    const prevOut = tokenOut;
    setTokenIn(prevOut);
    setTokenOut(prevIn);
    setAmountIn('');
    setQuote(null);
    setTxHash(null);
    updateSearchParams(prevOut, prevIn);
  }, [tokenIn, tokenOut, updateSearchParams]);

  const handleTokenInChange = useCallback(
    (t: Token) => {
      const newOut =
        tokenOut && t.address === tokenOut.address ? tokenIn : tokenOut;
      if (tokenOut && t.address === tokenOut.address) setTokenOut(tokenIn);
      setTokenIn(t);
      setQuote(null);
      setTxHash(null);
      updateSearchParams(t, newOut);
    },
    [tokenIn, tokenOut, updateSearchParams]
  );

  const handleTokenOutChange = useCallback(
    (t: Token) => {
      const newIn =
        tokenIn && t.address === tokenIn.address ? tokenOut : tokenIn;
      if (tokenIn && t.address === tokenIn.address) setTokenIn(tokenOut);
      setTokenOut(t);
      setQuote(null);
      setTxHash(null);
      updateSearchParams(newIn, t);
    },
    [tokenIn, tokenOut, updateSearchParams]
  );

  const handleSwap = useCallback(async () => {
    if (!tokenIn || !tokenOut || !feeToken || !walletClient || parsedAmountIn <= 0n || !quote) return;

    setStatus('pending');
    try {
      // Use minAmountOut with 0.5% slippage tolerance
      const minAmountOut = (quote * 995n) / 1000n;

      const hash = await Actions.dex.sell(walletClient, {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
        minAmountOut,
        feeToken: feeToken.address,
      });

      const receipt = await waitForTx(hash as `0x${string}`);
      setGasFee(receipt.gasUsed * receipt.effectiveGasPrice);
      setTxHash(hash);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Swap failed', {
        description: message.length > 120 ? 'Please try again.' : message,
      });
      setStatus('idle');
    }
  }, [tokenIn, tokenOut, feeToken, walletClient, parsedAmountIn, quote]);

  const handleReset = useCallback(() => {
    setAmountIn('');
    setQuote(null);
    setTxHash(null);
    setGasFee(null);
    setStatus('idle');
  }, []);

  if (!address) return null;

  return (
    <div className="max-w-md">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Swap</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">Exchange stablecoins on Tempo DEX</p>
      </motion.div>

      {/* Loading tokens */}
      {(!tokenIn || !tokenOut || !feeToken) && (
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
      {tokenIn && tokenOut && feeToken && (
        <AnimatePresence mode="wait">
          {/* Success */}
          {status === 'success' && txHash ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
            >
              <div className="px-6 pt-8 pb-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-[#6B8F71] flex items-center justify-center mx-auto mb-5"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                </motion.div>
                <p className="text-[17px] font-bold text-[#2D3436] mb-1">Swap Successful</p>
                <div className="flex items-center justify-center gap-2 text-[#6B6560] text-[14px]">
                  <span className="font-semibold text-[#2D3436]">
                    {formatAmount(parsedAmountIn, inDecimals)}
                  </span>
                  <span>{tokenIn.symbol}</span>
                  <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                  <span className="font-semibold text-[#2D3436]">
                    {quote ? formatAmount(quote, outDecimals) : '—'}
                  </span>
                  <span>{tokenOut.symbol}</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mx-6 mb-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 space-y-3"
              >
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
            /* Form */
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
                      onClick={handleSetMax}
                      className="text-[11px] text-[#9B9590] hover:text-[#E07A5F] transition-colors"
                    >
                      Balance: {formatAmount(tokenInBalance.value, inDecimals)}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountIn}
                      onChange={e => handleAmountInChange(e.target.value)}
                      disabled={status !== 'idle'}
                      className="flex-1 text-[28px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                    />
                    <TokenPicker
                      token={tokenIn}
                      tokens={tokens}
                      disabledAddresses={[tokenOut.address]}
                      onChange={handleTokenInChange}
                    />
                  </div>
                  {!hasBalance && parsedAmountIn > 0n && (
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
                      Balance: {formatAmount(tokenOutBalance.value, outDecimals)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-[28px] font-bold text-[#2D3436] min-w-0">
                      {isQuoting ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#9B9590]" />
                      ) : quote !== null && quote > 0n ? (
                        formatAmount(quote, outDecimals)
                      ) : parsedAmountIn > 0n ? (
                        <span className="text-[#D5D0CA]">—</span>
                      ) : (
                        <span className="text-[#D5D0CA]">0.00</span>
                      )}
                    </div>
                    <TokenPicker
                      token={tokenOut}
                      tokens={tokens}
                      disabledAddresses={[tokenIn.address]}
                      onChange={handleTokenOutChange}
                    />
                  </div>
                  {parsedAmountIn > 0n && !isQuoting && quote === null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>No liquidity for this pair</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Quote Details */}
              <AnimatePresence>
                {quote !== null && quote > 0n && parsedAmountIn > 0n && (
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
                          1 {tokenIn.symbol} ={' '}
                          {formatAmount(
                            (quote * BigInt(10 ** inDecimals)) / parsedAmountIn,
                            outDecimals
                          )}{' '}
                          {tokenOut.symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#9B9590]">Min. Received (0.5% slippage)</span>
                        <span className="text-[12px] font-medium text-[#2D3436]">
                          {formatAmount((quote * 995n) / 1000n, outDecimals)} {tokenOut.symbol}
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
                    {isQuoting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        Getting quote...
                      </>
                    ) : !amountIn || parsedAmountIn === 0n ? (
                      'Enter an amount'
                    ) : quote === null ? (
                      'No liquidity for this pair'
                    ) : !hasBalance ? (
                      `Insufficient ${tokenIn.symbol} balance`
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
                    <div className="rounded-xl border border-[#E07A5F]/20 bg-[#E07A5F]/[0.04] p-4">
                      <p className="text-[12px] font-semibold text-[#E07A5F] uppercase tracking-wider mb-2">
                        Confirm Swap
                      </p>
                      <div className="flex items-center gap-3 text-[14px]">
                        <span className="font-bold text-[#2D3436]">
                          {formatAmount(parsedAmountIn, inDecimals)}
                        </span>
                        <span className="text-[#6B6560]">{tokenIn.symbol}</span>
                        <ArrowDown className="w-3.5 h-3.5 text-[#9B9590]" />
                        <span className="font-bold text-[#2D3436]">
                          {quote ? formatAmount(quote, outDecimals) : '—'}
                        </span>
                        <span className="text-[#6B6560]">{tokenOut.symbol}</span>
                      </div>
                      <p className="text-[11px] text-[#9B9590] mt-2">
                        Min. received: {quote ? formatAmount((quote * 995n) / 1000n, outDecimals) : '—'}{' '}
                        {tokenOut.symbol} (0.5% slippage)
                      </p>
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
                            stroke="url(#dexSwapGrad)"
                            strokeWidth="1.5"
                            strokeDasharray="50 140"
                            strokeLinecap="round"
                          />
                          <defs>
                            <linearGradient id="dexSwapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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
                      Swapping {formatAmount(parsedAmountIn, inDecimals)} {tokenIn.symbol} for ~
                      {quote ? formatAmount(quote, outDecimals) : '—'} {tokenOut.symbol}
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
