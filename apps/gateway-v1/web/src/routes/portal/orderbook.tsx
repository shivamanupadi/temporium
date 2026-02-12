import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';
import { formatAmount, parseAmount } from '@/lib/utils';
import {
  getOrderbookInfo,
  getExplorerTxUrl,
  tickToPrice,
  priceToTick,
  MIN_TICK,
  MAX_TICK,
} from '@/lib/tempo-client';
import type { OrderbookInfo } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/orderbook')({
  component: OrderbookPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderSide = 'buy' | 'sell';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function OrderbookPage(): ReactElement | null {
  const { address, placeOrder, createPair } = useTempo();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();

  // Token pair
  const [baseToken, setBaseToken] = useState<Token | null>(null);
  const [quoteToken, setQuoteToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Defaults
  useEffect(() => {
    if (tokens.length > 0 && !baseToken) setBaseToken(tokens[0]);
    if (tokens.length > 1 && !quoteToken) setQuoteToken(tokens[1]);
    if (tokens.length > 0 && !feeToken) setFeeToken(tokens[0]);
  }, [tokens, baseToken, quoteToken, feeToken]);

  // Orderbook state
  const [orderbook, setOrderbook] = useState<OrderbookInfo | null>(null);
  const [pairExists, setPairExists] = useState<boolean | null>(null);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [isCreatingPair, setIsCreatingPair] = useState(false);

  // Order form
  const [side, setSide] = useState<OrderSide>('buy');
  const [price, setPrice] = useState('1.00000');
  const [amount, setAmount] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Computed tick from price
  const tick = priceToTick(price);
  const isValidTick = tick !== null;
  const tokenDecimals = baseToken?.decimals ?? 6;
  const parsedAmount = parseAmount(amount, tokenDecimals);

  // Balance: sell → need base tokens, buy → need quote tokens
  const relevantToken = side === 'sell' ? baseToken : quoteToken;
  const { data: relevantBalance } = useTokenBalance(relevantToken?.address, address);
  const hasBalance = relevantBalance.value >= parsedAmount;

  const canPlace =
    baseToken &&
    feeToken &&
    parsedAmount > 0n &&
    isValidTick &&
    hasBalance &&
    pairExists &&
    !isPlacing;

  const canCreatePair =
    baseToken && feeToken && pairExists === false && !isCreatingPair;

  // -------------------------------------------------------------------------
  // Fetch orderbook
  // -------------------------------------------------------------------------

  const fetchOrderbook = useCallback(async () => {
    if (!baseToken || !quoteToken) return;
    setIsLoadingBook(true);
    try {
      const info = await getOrderbookInfo(baseToken.address, quoteToken.address);
      if (info) {
        setOrderbook(info);
        setPairExists(true);
      } else {
        setOrderbook(null);
        setPairExists(false);
      }
    } catch {
      setOrderbook(null);
      setPairExists(false);
    } finally {
      setIsLoadingBook(false);
    }
  }, [baseToken, quoteToken]);

  useEffect(() => {
    fetchOrderbook();
  }, [fetchOrderbook]);

  // Auto-refresh orderbook
  useEffect(() => {
    if (!baseToken || !quoteToken) return;
    const interval = setInterval(fetchOrderbook, TIMING.POOL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [baseToken, quoteToken, fetchOrderbook]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handlePriceChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setPrice(cleaned);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmount(cleaned);
  }, []);

  const handleSetMax = useCallback(() => {
    if (relevantBalance.value > 0n && relevantToken) {
      setAmount(formatAmount(relevantBalance.value, relevantToken.decimals, relevantToken.decimals));
    }
  }, [relevantBalance.value, relevantToken]);

  const handleBaseChange = useCallback(
    (t: Token) => {
      if (quoteToken && t.address === quoteToken.address) {
        setQuoteToken(baseToken);
      }
      setBaseToken(t);
      setOrderbook(null);
      setPairExists(null);
    },
    [baseToken, quoteToken],
  );

  const handleQuoteChange = useCallback(
    (t: Token) => {
      if (baseToken && t.address === baseToken.address) {
        setBaseToken(quoteToken);
      }
      setQuoteToken(t);
      setOrderbook(null);
      setPairExists(null);
    },
    [baseToken, quoteToken],
  );

  const handleCreatePair = useCallback(async () => {
    if (!baseToken || !feeToken) return;
    setIsCreatingPair(true);
    try {
      await createPair({
        base: baseToken.address,
        feeToken: feeToken.address,
      });
      toast.success('Trading pair created', {
        description: `${baseToken.symbol} pair is now active on the exchange.`,
      });
      setPairExists(true);
      fetchOrderbook();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create pair', {
        description: message.length > 120 ? 'Please try again.' : message,
      });
    } finally {
      setIsCreatingPair(false);
    }
  }, [baseToken, feeToken, createPair, fetchOrderbook]);

  const handlePlaceOrder = useCallback(async () => {
    if (!canPlace || !baseToken || !feeToken || tick === null) return;

    setIsPlacing(true);
    setTxHash(null);
    try {
      const hash = await placeOrder({
        token: baseToken.address,
        amount: parsedAmount,
        tick,
        type: side,
        feeToken: feeToken.address,
      });
      setTxHash(hash);
      setAmount('');
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} order placed`, {
        description: `${formatAmount(parsedAmount, tokenDecimals)} ${baseToken.symbol} at ${tickToPrice(tick)}`,
      });
      fetchOrderbook();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('0xaa4bc69a')) {
        toast.error('Trading pair not found', {
          description: 'Create the trading pair first before placing orders.',
        });
        setPairExists(false);
      } else {
        toast.error('Order failed', {
          description: message.length > 120 ? 'Please try again.' : message,
        });
      }
    } finally {
      setIsPlacing(false);
    }
  }, [canPlace, baseToken, feeToken, tick, side, parsedAmount, tokenDecimals, placeOrder, fetchOrderbook]);

  if (!address) return null;

  const accentColor = side === 'buy' ? '#5B9A6F' : '#D35D3A';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-md">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Orderbook</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Place limit orders on the stablecoin exchange
        </p>
      </motion.div>

      {/* Loading / empty state */}
      {(!baseToken || !quoteToken || !feeToken) && (
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
          ) : tokens.length === 0 ? (
            <p className="text-[13px] text-[#9B9590]">No tokens available. Check your network connection.</p>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#9B9590]" />
              <span className="text-[13px] text-[#9B9590]">Initializing...</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Single unified card */}
      {baseToken && quoteToken && feeToken && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
        >
          {/* Buy / Sell Tabs */}
          <div className="flex border-b border-[#EDE9E3]">
            {(['buy', 'sell'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSide(s);
                  setTxHash(null);
                }}
                className={`flex-1 py-3 text-[13px] font-semibold text-center transition-all relative ${
                  side === s
                    ? s === 'buy'
                      ? 'text-[#5B9A6F]'
                      : 'text-[#D35D3A]'
                    : 'text-[#9B9590] hover:text-[#6B6560]'
                }`}
              >
                {s === 'buy' ? 'Buy' : 'Sell'} {baseToken.symbol}
                {side === s && (
                  <motion.div
                    layoutId="orderTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: s === 'buy' ? '#5B9A6F' : '#D35D3A' }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {/* Pair pickers — compact row */}
            <div className="flex items-center gap-2">
              <TokenPicker
                token={baseToken}
                tokens={tokens}
                disabledAddresses={[quoteToken.address]}
                onChange={handleBaseChange}
              />
              <span className="text-[#B5B0AA] font-semibold text-[13px]">/</span>
              <TokenPicker
                token={quoteToken}
                tokens={tokens}
                disabledAddresses={[baseToken.address]}
                onChange={handleQuoteChange}
              />

              {/* Inline market info */}
              <div className="ml-auto text-right">
                {isLoadingBook ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9590]" />
                ) : orderbook ? (
                  <div className="text-[10px] leading-tight">
                    <span className="text-[#5B9A6F] font-semibold">{tickToPrice(orderbook.bestBidTick)}</span>
                    <span className="text-[#B5B0AA] mx-1">/</span>
                    <span className="text-[#D35D3A] font-semibold">{tickToPrice(orderbook.bestAskTick)}</span>
                  </div>
                ) : pairExists === false ? (
                  <span className="text-[10px] text-amber-500 font-medium">No pair</span>
                ) : null}
              </div>
            </div>

            {/* Price Input */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Price
                </span>
                {isValidTick && tick !== null && (
                  <span className="text-[10px] text-[#9B9590]">
                    Tick {tick}{price !== tickToPrice(tick) ? ` \u2192 ${tickToPrice(tick)}` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="1.00000"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  disabled={isPlacing}
                  className="flex-1 text-[22px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                />
                <span className="text-[11px] font-medium text-[#9B9590] shrink-0">
                  {quoteToken.symbol}/{baseToken.symbol}
                </span>
              </div>
              {price && !isValidTick && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#D35D3A]">
                  <AlertTriangle className="w-3 h-3" />
                  Range: {tickToPrice(MIN_TICK)} &ndash; {tickToPrice(MAX_TICK)}
                </p>
              )}
            </div>

            {/* Amount Input */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Amount
                </span>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[10px] text-[#9B9590] hover:text-[#6B6560] transition-colors"
                >
                  Bal: {formatAmount(relevantBalance.value, relevantToken?.decimals ?? 6)} {relevantToken?.symbol}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={isPlacing}
                  className="flex-1 text-[22px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                />
                <span className="text-[13px] font-medium text-[#9B9590] shrink-0">
                  {baseToken.symbol}
                </span>
              </div>
              {amount && parsedAmount > 0n && !hasBalance && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#D35D3A]">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient {relevantToken?.symbol} balance
                </p>
              )}
            </div>

            {/* Fee token — single compact row */}
            <div className="flex items-center justify-between px-1">
              <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
            </div>

            {/* Submit — Create Pair OR Place Order */}
            {pairExists === false ? (
              <Button
                onClick={handleCreatePair}
                disabled={!canCreatePair}
                className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#9B72CF] hover:bg-[#8660B8] text-white disabled:opacity-80"
              >
                {isCreatingPair ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating pair...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create {baseToken.symbol} Trading Pair
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handlePlaceOrder}
                disabled={!canPlace}
                className={`w-full h-11 rounded-xl text-[14px] font-semibold text-white disabled:opacity-100 disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA] ${
                  side === 'buy'
                    ? 'bg-[#5B9A6F] hover:bg-[#4E8A62]'
                    : 'bg-[#D35D3A] hover:bg-[#C34D2A]'
                }`}
              >
                {isPlacing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Placing order...
                  </>
                ) : !isValidTick ? (
                  'Invalid price'
                ) : !amount || parsedAmount === 0n ? (
                  'Enter an amount'
                ) : !hasBalance ? (
                  `Insufficient ${relevantToken?.symbol} balance`
                ) : (
                  `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`
                )}
              </Button>
            )}

            {/* Transaction Success */}
            <AnimatePresence>
              {txHash && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{
                    backgroundColor: `${accentColor}0A`,
                    borderColor: `${accentColor}33`,
                  }}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#2D3436]">Order placed</p>
                    <p className="text-[11px] text-[#6B6560] font-mono truncate">{txHash}</p>
                  </div>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                    style={{ color: accentColor }}
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
