import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ExternalLink,
  DollarSign,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { formatAmount, parseAmount, cn } from '@/lib/utils';
import { TIMING } from '@/lib/constants';
import { getSwapQuote, getExplorerTxUrl } from '@/lib/tempo-client';
import type { Address } from 'viem';
import { getTokenColors, type Token } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/swap')({
  component: SwapPage,
});

type ModalState = 'confirm' | 'pending' | 'success' | null;

function SwapPage(): ReactElement | null {
  const { address, swapTokens } = useTempo();
  const navigate = useNavigate();
  const { tokens } = useTokenList();

  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [slippage] = useState(0.5); // 0.5% default slippage

  // Set default tokens
  useEffect(() => {
    if (tokens.length >= 2 && !tokenIn) {
      const defaultIn = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0];
      const defaultOut = tokens.find(t => t.symbol !== defaultIn.symbol) || tokens[1];
      setTokenIn(defaultIn);
      setTokenOut(defaultOut);
    }
  }, [tokens, tokenIn]);

  const balanceIn = useTokenBalance(tokenIn?.address as Address);
  const balanceOut = useTokenBalance(tokenOut?.address as Address);

  // Fetch quote when amount or tokens change
  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn) {
      setAmountOut('');
      return;
    }

    const parsedIn = parseAmount(amountIn, tokenIn.decimals);
    if (parsedIn === 0n) {
      setAmountOut('');
      return;
    }

    let cancelled = false;
    setIsQuoting(true);

    const fetchQuote = async (): Promise<void> => {
      try {
        const quote = await getSwapQuote(tokenIn.address, tokenOut.address, parsedIn);
        if (!cancelled) {
          // If quote is 0, it means no liquidity
          setAmountOut(formatAmount(quote.toString(), tokenOut.decimals));
        }
      } catch (err) {
        console.error('Quote error:', err);
        if (!cancelled) {
          setAmountOut('0'); // Set to '0' to indicate no liquidity
        }
      } finally {
        if (!cancelled) {
          setIsQuoting(false);
        }
      }
    };

    const debounce = setTimeout(fetchQuote, TIMING.DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [tokenIn, tokenOut, amountIn]);

  const handleSwapTokens = useCallback(() => {
    const tempToken = tokenIn;
    const tempAmount = amountIn;
    setTokenIn(tokenOut);
    setTokenOut(tempToken);
    setAmountIn(amountOut);
    setAmountOut(tempAmount);
  }, [tokenIn, tokenOut, amountIn, amountOut]);

  if (!address) return null;

  const parsedAmountIn = tokenIn ? parseAmount(amountIn, tokenIn.decimals) : 0n;
  const parsedAmountOut = tokenOut ? parseAmount(amountOut, tokenOut.decimals) : 0n;
  const hasBalance = balanceIn.data?.value && balanceIn.data.value >= parsedAmountIn;
  const minAmountOut =
    parsedAmountOut - (parsedAmountOut * BigInt(Math.floor(slippage * 100))) / 10000n;

  // Check if there's no liquidity (quote returned 0 but we have input)
  const noLiquidity = amountIn && parsedAmountIn > 0n && !isQuoting && amountOut === '0.00';

  const isValidForm =
    tokenIn &&
    tokenOut &&
    parsedAmountIn > 0n &&
    parsedAmountOut > 0n &&
    hasBalance &&
    feeToken &&
    tokenIn.address !== tokenOut.address &&
    !noLiquidity;

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !tokenIn || !tokenOut || !feeToken) return;
    setModalState('pending');
    try {
      const hash = await swapTokens({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
        minAmountOut,
        feeToken: feeToken.address,
      });
      setTxHash(hash);
      setModalState('success');
    } catch (err) {
      console.error(err);
      // Check for InsufficientLiquidity error (0x13be252b)
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('0x13be252b') || errorMessage.includes('InsufficientLiquidity')) {
        toast.error('No liquidity available', {
          description: 'This trading pair has no liquidity on testnet',
        });
      } else {
        toast.error('Swap failed', {
          description: 'Please try again or contact support',
        });
      }
      setModalState('confirm');
    }
  };

  const resetForm = (): void => {
    setAmountIn('');
    setAmountOut('');
    setTxHash(null);
    setModalState(null);
  };

  const handleCloseModal = (): void => {
    if (modalState === 'success') {
      resetForm();
    } else if (modalState !== 'pending') {
      setModalState(null);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate({ to: '/portal/dashboard' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">Swap</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-5 space-y-4">
        {/* Token In Section */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              You Pay
            </span>
            <button
              onClick={() => {
                if (balanceIn.data?.value && tokenIn) {
                  setAmountIn(formatAmount(balanceIn.data.value.toString(), tokenIn.decimals));
                }
              }}
              className="text-[11px] text-muted-foreground"
            >
              Balance:{' '}
              {balanceIn.isLoading
                ? '...'
                : formatAmount(balanceIn.data?.value.toString() || '0', tokenIn?.decimals)}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amountIn}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  if (val.split('.').length <= 2) setAmountIn(val);
                }}
                className="w-full text-2xl font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Token Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-9 px-3 min-w-[110px] bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {tokenIn && (
                    <>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(tokenIn.symbol).bg }}
                      >
                        <DollarSign
                          className="h-3 w-3"
                          style={{ color: getTokenColors(tokenIn.symbol).text }}
                        />
                      </div>
                      <span className="text-[13px] font-medium">{tokenIn.symbol}</span>
                    </>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tokens.map(token => (
                  <DropdownMenuItem
                    key={token.address}
                    onClick={() => {
                      if (token.address === tokenOut?.address) {
                        setTokenOut(tokenIn);
                      }
                      setTokenIn(token);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(token.symbol).bg }}
                      >
                        <DollarSign
                          className="h-3 w-3"
                          style={{ color: getTokenColors(token.symbol).text }}
                        />
                      </div>
                      {token.symbol}
                    </div>
                    {tokenIn?.address === token.address && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {amountIn && parsedAmountIn > 0n && !hasBalance && (
            <p className="text-[11px] text-destructive mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Insufficient balance
            </p>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="w-10 h-10 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Token Out Section */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              You Receive
            </span>
            <span className="text-[11px] text-muted-foreground">
              Balance:{' '}
              {balanceOut.isLoading
                ? '...'
                : formatAmount(balanceOut.data?.value.toString() || '0', tokenOut?.decimals)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              {isQuoting ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              ) : (
                <span
                  className={cn(
                    'text-2xl font-medium',
                    amountOut ? 'text-foreground' : 'text-muted-foreground/40'
                  )}
                >
                  {amountOut || '0'}
                </span>
              )}
            </div>

            {/* Token Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-9 px-3 min-w-[110px] bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {tokenOut && (
                    <>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(tokenOut.symbol).bg }}
                      >
                        <DollarSign
                          className="h-3 w-3"
                          style={{ color: getTokenColors(tokenOut.symbol).text }}
                        />
                      </div>
                      <span className="text-[13px] font-medium">{tokenOut.symbol}</span>
                    </>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tokens.map(token => (
                  <DropdownMenuItem
                    key={token.address}
                    onClick={() => {
                      if (token.address === tokenIn?.address) {
                        setTokenIn(tokenOut);
                      }
                      setTokenOut(token);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(token.symbol).bg }}
                      >
                        <DollarSign
                          className="h-3 w-3"
                          style={{ color: getTokenColors(token.symbol).text }}
                        />
                      </div>
                      {token.symbol}
                    </div>
                    {tokenOut?.address === token.address && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* No Liquidity Warning */}
          {noLiquidity && (
            <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No liquidity available for this pair on testnet
            </p>
          )}
        </div>

        {/* Rate Info */}
        {tokenIn && tokenOut && parsedAmountIn > 0n && parsedAmountOut > 0n && !noLiquidity && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Rate</span>
              <span className="text-foreground">
                1 {tokenIn.symbol} = {(Number(amountOut) / Number(amountIn)).toFixed(4)}{' '}
                {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Slippage</span>
              <span className="text-foreground">{slippage}%</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Min. received</span>
              <span className="text-foreground">
                {formatAmount(minAmountOut.toString(), tokenOut.decimals)} {tokenOut.symbol}
              </span>
            </div>
          </div>
        )}

        <FeeTokenSelector
          value={feeToken}
          onChange={setFeeToken}
          className="pt-2 border-t border-border"
        />

        {/* Submit */}
        <Button
          className="w-full h-11 text-[14px] font-medium"
          disabled={!isValidForm || isQuoting}
          onClick={() => setModalState('confirm')}
        >
          {isQuoting ? 'Getting quote...' : noLiquidity ? 'No Liquidity' : 'Review Swap'}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent
          hideClose={modalState === 'pending'}
          className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl"
        >
          {/* CONFIRM STATE */}
          {modalState === 'confirm' && tokenIn && tokenOut && feeToken && (
            <>
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-semibold">Confirm Swap</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Review the details before confirming
                </DialogDescription>
              </div>

              <div className="px-6 pb-6">
                {/* From Token Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(tokenIn.symbol).bg }}
                      >
                        <DollarSign
                          className="h-5 w-5"
                          style={{ color: getTokenColors(tokenIn.symbol).text }}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">You Pay</p>
                        <p className="text-lg font-semibold text-foreground">
                          {amountIn} {tokenIn.symbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-1.5 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white border border-border/50 flex items-center justify-center">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                {/* To Token Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(tokenOut.symbol).bg }}
                      >
                        <DollarSign
                          className="h-5 w-5"
                          style={{ color: getTokenColors(tokenOut.symbol).text }}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">You Receive</p>
                        <p className="text-lg font-semibold text-foreground">
                          {amountOut} {tokenOut.symbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Card */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Rate</span>
                    <span className="text-xs font-medium text-foreground">
                      1 {tokenIn.symbol} = {(Number(amountOut) / Number(amountIn)).toFixed(4)}{' '}
                      {tokenOut.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Min. received</span>
                    <span className="text-xs font-medium text-foreground">
                      {formatAmount(minAmountOut.toString(), tokenOut.decimals)} {tokenOut.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Slippage</span>
                    <span className="text-xs font-medium text-foreground">{slippage}%</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setModalState(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>Confirm</Button>
              </div>
            </>
          )}

          {/* PENDING STATE */}
          {modalState === 'pending' && tokenIn && tokenOut && (
            <div className="relative overflow-hidden">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing your swap</DialogDescription>

              {/* Ambient background glow */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-20 -left-20 w-40 h-40 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)',
                  }}
                />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)',
                  }}
                />
              </div>

              <div className="relative px-6 py-12 text-center">
                {/* Animated icon container */}
                <div className="relative inline-flex items-center justify-center mb-6">
                  {/* Outer rotating ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute w-16 h-16"
                  >
                    <svg viewBox="0 0 64 64" className="w-full h-full">
                      <circle
                        cx="32"
                        cy="32"
                        r="30"
                        fill="none"
                        stroke="url(#swapPendingGradient)"
                        strokeWidth="1.5"
                        strokeDasharray="50 140"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient
                          id="swapPendingGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor="rgba(52,211,153,0.7)" />
                          <stop offset="100%" stopColor="rgba(52,211,153,0.1)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </motion.div>

                  {/* Inner pulsing circle */}
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-emerald-50"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-5 h-5 text-emerald-500" />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Swapping
                  </p>
                  <p className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
                    {amountIn}
                    <span className="text-[18px] font-medium text-muted-foreground ml-2">
                      {tokenIn.symbol}
                    </span>
                  </p>
                  <div className="flex items-center justify-center my-2">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
                    {amountOut}
                    <span className="text-[18px] font-medium text-muted-foreground ml-2">
                      {tokenOut.symbol}
                    </span>
                  </p>
                </motion.div>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {modalState === 'success' && txHash && tokenIn && tokenOut && (
            <div className="relative overflow-hidden bg-white">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Swap completed</DialogDescription>

              <div className="relative px-6 pt-10 pb-8 text-center">
                {/* Animated success icon */}
                <div className="relative inline-flex items-center justify-center mb-8">
                  {/* Circle container */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    {/* Animated checkmark SVG */}
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-white"
                    >
                      <motion.path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
                      />
                    </svg>
                  </motion.div>
                </div>

                {/* Success text */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="text-foreground text-sm font-semibold mb-1"
                >
                  Swap Successful
                </motion.p>

                {/* Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="mb-6"
                >
                  <span className="text-2xl font-semibold text-foreground">{amountIn}</span>
                  <span className="text-base text-muted-foreground ml-1.5">{tokenIn.symbol}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="text-2xl font-semibold text-foreground">{amountOut}</span>
                  <span className="text-base text-muted-foreground ml-1.5">{tokenOut.symbol}</span>
                </motion.div>

                {/* Details card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-3 text-left"
                >
                  {/* Rate */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Rate</span>
                    <span className="text-xs font-medium text-foreground">
                      1 {tokenIn.symbol} = {(Number(amountOut) / Number(amountIn)).toFixed(4)}{' '}
                      {tokenOut.symbol}
                    </span>
                  </div>

                  {/* Transaction hash */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transaction</span>
                    <button
                      onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="font-mono">
                        {txHash.slice(0, 8)}...{txHash.slice(-4)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="px-6 pb-6 flex items-center gap-2"
              >
                <Button className="flex-1" onClick={resetForm}>
                  Done
                </Button>
              </motion.div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
