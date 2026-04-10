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
import { type Address, parseAbiItem } from 'viem';
import { Abis, Addresses } from 'viem/tempo';
import {
  tempoChain,
  tempoPublicClient,
  getExplorerTxUrl,
  waitForTx,
  Actions,
} from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';

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

/** Swap route — direct or multi-hop via an intermediate token */
interface SwapRoute {
  path: Address[];
  quotes: bigint[]; // quote for each hop
  amountOut: bigint; // final output
}

/** Try a direct quote, return null on failure */
async function getDirectQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<bigint | null> {
  try {
    return await Actions.dex.getSellQuote(tempoPublicClient, { tokenIn, tokenOut, amountIn });
  } catch {
    return null;
  }
}

/** Find the best swap route — direct or via quote token */
async function findSwapRoute(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<SwapRoute | null> {
  // Try direct first
  const directQuote = await getDirectQuote(tokenIn, tokenOut, amountIn);
  if (directQuote !== null && directQuote > 0n) {
    return { path: [tokenIn, tokenOut], quotes: [directQuote], amountOut: directQuote };
  }

  // Try multi-hop via quote tokens
  // Each TIP20 has a quoteToken — try routing through it
  const quoteTokens = new Set<string>();

  for (const addr of [tokenIn, tokenOut]) {
    try {
      const qt = (await tempoPublicClient.readContract({
        address: addr,
        abi: Abis.tip20,
        functionName: 'quoteToken',
      })) as Address;
      if (qt && qt !== '0x0000000000000000000000000000000000000000') {
        quoteTokens.add(qt.toLowerCase());
      }
    } catch {
      // Token might not have a quoteToken
    }
  }

  // Also try pathUSD as a common intermediate
  quoteTokens.add('0x20c0000000000000000000000000000000000000');

  let bestRoute: SwapRoute | null = null;

  for (const intermediate of quoteTokens) {
    if (intermediate === tokenIn.toLowerCase() || intermediate === tokenOut.toLowerCase()) continue;

    const hop1 = await getDirectQuote(tokenIn, intermediate as Address, amountIn);
    if (!hop1 || hop1 <= 0n) continue;

    const hop2 = await getDirectQuote(intermediate as Address, tokenOut, hop1);
    if (!hop2 || hop2 <= 0n) continue;

    if (!bestRoute || hop2 > bestRoute.amountOut) {
      bestRoute = {
        path: [tokenIn, intermediate as Address, tokenOut],
        quotes: [hop1, hop2],
        amountOut: hop2,
      };
    }
  }

  return bestRoute;
}

interface RecentSwap {
  txHash: string;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  blockNumber: bigint;
  timestamp: bigint;
}

function formatTimeAgo(timestamp: bigint): string {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// ~24h of blocks (assuming ~1s block time)
const LOOKBACK_BLOCKS = 86400n;
const MAX_BLOCK_RANGE = 99999n;

/** Fetch Transfer logs in chunks (RPC limits range to ~100k blocks) */
async function fetchTransferLogs(
  args: { from?: Address; to?: Address },
  fromBlock: bigint,
  toBlock: bigint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const chunks = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + MAX_BLOCK_RANGE > toBlock ? toBlock : start + MAX_BLOCK_RANGE;
    chunks.push(
      tempoPublicClient.getLogs({ event: TRANSFER_EVENT, args, fromBlock: start, toBlock: end })
    );
    start = end + 1n;
  }
  return (await Promise.all(chunks)).flat();
}

function useRecentSwaps(userAddress: Address | undefined): {
  swaps: RecentSwap[];
  isLoading: boolean;
  refresh: () => void;
} {
  const [swaps, setSwaps] = useState<RecentSwap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userAddress) {
      setSwaps([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSwaps(): Promise<void> {
      try {
        const dexAddr = Addresses.stablecoinDex.toLowerCase();
        const blockNum = await tempoPublicClient.getBlockNumber();
        const fromBlock = blockNum > LOOKBACK_BLOCKS ? blockNum - LOOKBACK_BLOCKS : 0n;

        // Fetch transfers where the user sends to or receives from anyone
        // Then filter to only txs involving the DEX
        const [sent, received] = await Promise.all([
          fetchTransferLogs({ from: userAddress }, fromBlock, blockNum),
          fetchTransferLogs({ to: userAddress }, fromBlock, blockNum),
        ]);

        // Deduplicate and group by txHash
        const allLogs = [...sent, ...received];
        const seen = new Set<string>();
        const byTx = new Map<string, typeof allLogs>();
        for (const log of allLogs) {
          const uid = `${log.transactionHash}:${log.logIndex}`;
          if (seen.has(uid)) continue;
          seen.add(uid);
          const tx = log.transactionHash!;
          if (!byTx.has(tx)) byTx.set(tx, []);
          byTx.get(tx)!.push(log);
        }

        const results: RecentSwap[] = [];
        for (const [txHash, logs] of byTx) {
          // Only process txs that involve the DEX contract
          const hasDex = logs.some(log => {
            const from = (log.args as { from: Address }).from;
            const to = (log.args as { to: Address }).to;
            return from.toLowerCase() === dexAddr || to.toLowerCase() === dexAddr;
          });
          if (!hasDex) continue;

          // Compute net flow per token for the user
          const flows = new Map<string, bigint>();

          for (const log of logs) {
            const from = (log.args as { from: Address }).from;
            const to = (log.args as { to: Address }).to;
            const value = (log.args as { value: bigint }).value;
            const token = (log.address as Address).toLowerCase();

            if (from.toLowerCase() === userAddress!.toLowerCase()) {
              // User sent tokens (negative)
              flows.set(token, (flows.get(token) ?? 0n) - value);
            }
            if (to.toLowerCase() === userAddress!.toLowerCase()) {
              // User received tokens (positive)
              flows.set(token, (flows.get(token) ?? 0n) + value);
            }
          }

          // Find tokenIn (largest negative) and tokenOut (largest positive)
          let tokenIn: Address | null = null;
          let tokenOut: Address | null = null;
          let amountIn = 0n;
          let amountOut = 0n;

          for (const [token, net] of flows) {
            if (net < 0n && -net > amountIn) {
              tokenIn = token as Address;
              amountIn = -net;
            }
            if (net > 0n && net > amountOut) {
              tokenOut = token as Address;
              amountOut = net;
            }
          }

          if (tokenIn && tokenOut && amountIn > 0n && amountOut > 0n) {
            results.push({
              txHash,
              taker: userAddress!,
              tokenIn,
              tokenOut,
              amountIn,
              amountOut,
              blockNumber: logs[0].blockNumber!,
              timestamp: logs[0].blockTimestamp ?? 0n,
            });
          }
        }

        // Sort by block number descending, take latest 15
        results.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        if (!cancelled) setSwaps(results.slice(0, 15));
      } catch (err) {
        console.error('[RecentSwaps] Failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchSwaps();
    return () => {
      cancelled = true;
    };
  }, [userAddress, refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return { swaps, isLoading, refresh };
}

function DexSwapPage(): ReactElement | null {
  const { address } = useTempo();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { data: walletClient } = useWalletClient();
  const { from, to } = Route.useSearch();
  const navigate = useNavigate();
  const {
    swaps: recentSwaps,
    isLoading: isLoadingSwaps,
    refresh: refreshSwaps,
  } = useRecentSwaps(address);

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
    const toToken = to ? tokens.find(t => t.address.toLowerCase() === to.toLowerCase()) : null;
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
  const [route, setRoute] = useState<SwapRoute | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [gasFee, setGasFee] = useState<bigint | null>(null);

  const quote = route?.amountOut ?? null;

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

  // Find swap route (direct or multi-hop)
  useEffect(() => {
    if (!tokenIn || !tokenOut || parsedAmountIn <= 0n || tokenIn.address === tokenOut.address) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setIsQuoting(true);

    findSwapRoute(tokenIn.address, tokenOut.address, parsedAmountIn)
      .then(result => {
        if (!cancelled) setRoute(result);
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
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
    setRoute(null);
    setTxHash(null);
    updateSearchParams(prevOut, prevIn);
  }, [tokenIn, tokenOut, updateSearchParams]);

  const handleTokenInChange = useCallback(
    (t: Token) => {
      const newOut = tokenOut && t.address === tokenOut.address ? tokenIn : tokenOut;
      if (tokenOut && t.address === tokenOut.address) setTokenOut(tokenIn);
      setTokenIn(t);
      setRoute(null);
      setTxHash(null);
      updateSearchParams(t, newOut);
    },
    [tokenIn, tokenOut, updateSearchParams]
  );

  const handleTokenOutChange = useCallback(
    (t: Token) => {
      const newIn = tokenIn && t.address === tokenIn.address ? tokenOut : tokenIn;
      if (tokenIn && t.address === tokenIn.address) setTokenIn(tokenOut);
      setTokenOut(t);
      setRoute(null);
      setTxHash(null);
      updateSearchParams(newIn, t);
    },
    [tokenIn, tokenOut, updateSearchParams]
  );

  const handleSwap = useCallback(async () => {
    if (
      !tokenIn ||
      !tokenOut ||
      !feeToken ||
      !walletClient ||
      !address ||
      parsedAmountIn <= 0n ||
      !route
    )
      return;

    setStatus('pending');
    try {
      const dexAddress = Addresses.stablecoinDex as Address;

      // Build calls: approvals + swaps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls: any[] = [];

      // Check approval for tokenIn
      const allowance = (await tempoPublicClient.readContract({
        address: tokenIn.address,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'allowance',
        args: [address, dexAddress],
      })) as bigint;

      if (allowance < parsedAmountIn) {
        calls.push(
          Actions.token.approve.call({
            token: tokenIn.address,
            spender: dexAddress,
            amount: parsedAmountIn,
          })
        );
      }

      if (route.path.length === 2) {
        // Direct swap
        const minAmountOut = (route.amountOut * 995n) / 1000n;
        calls.push(
          Actions.dex.sell.call({
            tokenIn: route.path[0],
            tokenOut: route.path[1],
            amountIn: parsedAmountIn,
            minAmountOut,
          })
        );
      } else {
        // Multi-hop: approve intermediate + swap each hop
        const intermediate = route.path[1];

        const intermediateAllowance = (await tempoPublicClient.readContract({
          address: intermediate,
          abi: [
            {
              name: 'allowance',
              type: 'function',
              stateMutability: 'view',
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
              ],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'allowance',
          args: [address, dexAddress],
        })) as bigint;

        if (intermediateAllowance < route.quotes[0]) {
          calls.push(
            Actions.token.approve.call({
              token: intermediate,
              spender: dexAddress,
              amount: route.quotes[0],
            })
          );
        }

        const minHop1 = (route.quotes[0] * 995n) / 1000n;
        calls.push(
          Actions.dex.sell.call({
            tokenIn: route.path[0],
            tokenOut: route.path[1],
            amountIn: parsedAmountIn,
            minAmountOut: minHop1,
          })
        );

        const minHop2 = (route.quotes[1] * 995n) / 1000n;
        calls.push(
          Actions.dex.sell.call({
            tokenIn: route.path[1],
            tokenOut: route.path[2],
            amountIn: route.quotes[0],
            minAmountOut: minHop2,
          })
        );
      }

      // Execute all calls in a single batch transaction
      // Use sendTransaction with calls[] (not sendCalls) so feeToken is respected
      const hash = await walletClient.sendTransaction({
        calls,
        feeToken: feeToken.address,
      } as any);

      const receipt = await waitForTx(hash as `0x${string}`);
      setGasFee(receipt.gasUsed * receipt.effectiveGasPrice);
      setTxHash(hash);
      setStatus('success');
      refreshSwaps();
    } catch (err) {
      console.error('[DEX Swap] Error:', err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Swap failed', { description: message });
      setStatus('idle');
    }
  }, [tokenIn, tokenOut, feeToken, walletClient, address, parsedAmountIn, route]);

  const handleReset = useCallback(() => {
    setAmountIn('');
    setRoute(null);
    setTxHash(null);
    setGasFee(null);
    setStatus('idle');
  }, []);

  if (!address) return null;

  return (
    <div>
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

      <div className="flex gap-6 items-start">
        {/* Left: Swap Form */}
        <div className="max-w-md flex-1 min-w-0">
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
                  className="rounded-2xl border border-[#5B9A6F]/20 bg-[#5B9A6F]/[0.03] overflow-hidden"
                >
                  <div className="px-6 pt-8 pb-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                      className="w-14 h-14 rounded-full bg-[#5B9A6F] flex items-center justify-center mx-auto mb-5"
                    >
                      <CheckCircle className="w-7 h-7 text-white" />
                    </motion.div>
                    <p className="text-[17px] font-bold text-[#2D3436] mb-1">Swap Successful</p>
                    <div className="flex items-center justify-center gap-2 text-[14px]">
                      <span className="font-semibold text-[#2D3436]">
                        {formatAmount(parsedAmountIn, inDecimals)}
                      </span>
                      <span className="text-[#6B6560]">{tokenIn.symbol}</span>
                      <ArrowDown className="w-3.5 h-3.5 text-[#5B9A6F]" />
                      <span className="font-semibold text-[#2D3436]">
                        {quote ? formatAmount(quote, outDecimals) : '—'}
                      </span>
                      <span className="text-[#6B6560]">{tokenOut.symbol}</span>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="mx-6 mb-4 rounded-xl bg-white/60 border border-[#5B9A6F]/10 p-4 space-y-3"
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
                        className="flex items-center gap-1 text-[12px] font-mono text-[#5B9A6F] hover:text-[#4A8A5E] transition-colors"
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
                      className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#5B9A6F] hover:bg-[#4A8A5E] text-white"
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
                  className="rounded-2xl border border-[#EDE9E3] bg-white"
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
                          {/* Swap Route Tree */}
                          {route && (
                            <div>
                              <span className="text-[12px] text-[#9B9590] mb-2 block">
                                Swap Route
                              </span>
                              <div className="font-mono text-[12px] space-y-0.5">
                                {route.path.map((addr, i) => {
                                  const t = tokens.find(
                                    tk => tk.address.toLowerCase() === addr.toLowerCase()
                                  );
                                  const symbol = t?.symbol ?? `${addr.slice(0, 8)}...`;
                                  const decimals = t?.decimals ?? 6;
                                  const isFirst = i === 0;
                                  const isLast = i === route.path.length - 1;
                                  const isMiddle = !isFirst && !isLast;
                                  const amount = isFirst ? parsedAmountIn : route.quotes[i - 1];
                                  const prefix = isFirst
                                    ? '\u250C\u2500\u2500'
                                    : isLast
                                      ? '\u2514\u2500\u2500'
                                      : '\u2502  ';
                                  const label = isFirst ? 'INPUT' : isLast ? 'OUTPUT' : '';

                                  return (
                                    <div key={addr} className="flex items-baseline justify-between">
                                      <span
                                        className={isMiddle ? 'text-[#9B72CF]' : 'text-[#2D3436]'}
                                      >
                                        {prefix} {symbol}
                                      </span>
                                      <span className="text-[#6B6560]">
                                        {formatAmount(amount, decimals, 4)}{' '}
                                        {label && (
                                          <span className="text-[#9B9590] text-[10px]">
                                            {label}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
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
                            <span className="text-[12px] text-[#9B9590]">
                              Min. Received (0.5% slippage)
                            </span>
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
                            Min. received:{' '}
                            {quote ? formatAmount((quote * 995n) / 1000n, outDecimals) : '—'}{' '}
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
                                <linearGradient
                                  id="dexSwapGrad"
                                  x1="0%"
                                  y1="0%"
                                  x2="100%"
                                  y2="100%"
                                >
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

        {/* Right: Recent Swaps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="flex-1 shrink-0 sticky top-6 hidden lg:block"
        >
          <div className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EDE9E3] bg-[#FDFBF8]">
              <h3 className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Your Recent Swaps
              </h3>
            </div>
            {isLoadingSwaps ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9590]" />
                <span className="text-[12px] text-[#9B9590]">Loading...</span>
              </div>
            ) : recentSwaps.length === 0 ? (
              <p className="text-[12px] text-[#9B9590] text-center py-10">No recent swaps</p>
            ) : (
              <div className="divide-y divide-[#EDE9E3] max-h-[calc(100vh-200px)] overflow-y-auto">
                {recentSwaps.map(swap => {
                  const tIn = tokens.find(
                    t => t.address.toLowerCase() === swap.tokenIn.toLowerCase()
                  );
                  const tOut = tokens.find(
                    t => t.address.toLowerCase() === swap.tokenOut.toLowerCase()
                  );
                  const colorsIn = getTokenColors(tIn?.symbol ?? '');
                  const colorsOut = getTokenColors(tOut?.symbol ?? '');
                  return (
                    <a
                      key={swap.txHash}
                      href={getExplorerTxUrl(swap.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-[#FDFBF8] hover:bg-[#F5F2ED] transition-colors group"
                    >
                      {/* Token pair icons */}
                      <div className="relative shrink-0 w-8 h-8">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden absolute top-0 left-0 border-2 border-white"
                          style={{ backgroundColor: colorsIn.bg }}
                        >
                          {tIn?.logoURI ? (
                            <img
                              src={tIn.logoURI}
                              alt={tIn.symbol}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-[8px] font-bold" style={{ color: colorsIn.text }}>
                              {(tIn?.symbol ?? '?').slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden absolute bottom-0 right-0 border-2 border-white"
                          style={{ backgroundColor: colorsOut.bg }}
                        >
                          {tOut?.logoURI ? (
                            <img
                              src={tOut.logoURI}
                              alt={tOut.symbol}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              className="text-[8px] font-bold"
                              style={{ color: colorsOut.text }}
                            >
                              {(tOut?.symbol ?? '?').slice(0, 2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Swap details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] flex items-center gap-1">
                          <span className="font-medium text-[#2D3436]">
                            {formatAmount(swap.amountIn, tIn?.decimals ?? 6)}
                          </span>
                          <span className="text-[#9B9590]">{tIn?.symbol ?? '?'}</span>
                          <span className="text-[#D5D0CA] mx-0.5">→</span>
                          <span className="font-medium text-[#2D3436]">
                            {formatAmount(swap.amountOut, tOut?.decimals ?? 6)}
                          </span>
                          <span className="text-[#9B9590]">{tOut?.symbol ?? '?'}</span>
                        </div>
                        <span className="text-[10px] text-[#B5B0AA]">
                          {formatTimeAgo(swap.timestamp)}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-[#D5D0CA] group-hover:text-[#E07A5F] transition-colors shrink-0 flex items-center gap-1">
                        {swap.txHash.slice(0, 6)}...{swap.txHash.slice(-4)}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
