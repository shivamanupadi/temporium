import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Plus,
  Minus,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';
import { formatAmount, parseAmount } from '@/lib/utils';
import {
  getPoolInfo,
  getLiquidityBalance,
  getExplorerTxUrl,
  waitForTx,
  type PoolInfo,
} from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/liquidity')({
  component: LiquidityPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'add' | 'remove';

function LiquidityPage(): ReactElement | null {
  const { address, addLiquidity, removeLiquidity } = useTempo();
  const { tokens } = useTokenList();

  // Token selection
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Default tokens from tokenlist
  useEffect(() => {
    if (tokens.length >= 2 && !tokenA) {
      const defaultA = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0];
      const defaultB = tokens.find(t => t.address !== defaultA.address) || tokens[1];
      setTokenA(defaultA);
      setTokenB(defaultB);
    }
    if (tokens.length > 0 && !feeToken) setFeeToken(tokens[0]);
  }, [tokens, tokenA, feeToken]);

  // Tab & form state
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const [amount, setAmount] = useState('');

  // Pool info & LP balance
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  // Transaction state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Token balances
  const { data: tokenABalanceData, isLoading: isTokenABalanceLoading } = useTokenBalance(
    tokenA?.address,
    address
  );
  const { data: tokenBBalanceData, isLoading: isTokenBBalanceLoading } = useTokenBalance(
    tokenB?.address,
    address
  );

  // LP tokens use 18 decimals, stablecoins use token decimals
  const decimalsForAmount = activeTab === 'add' ? (tokenB?.decimals ?? 6) : 18;
  const parsedAmount = parseAmount(amount, decimalsForAmount);

  // Estimate required Token A amount from pool ratio
  const estimatedTokenAAmount =
    activeTab === 'add' && poolInfo && poolInfo.reserveValidatorToken > 0n && parsedAmount > 0n
      ? (parsedAmount * poolInfo.reserveUserToken) / poolInfo.reserveValidatorToken
      : null;

  const hasTokenBBalance =
    activeTab === 'add' ? tokenBBalanceData.value >= parsedAmount : lpBalance >= parsedAmount;
  const hasTokenABalance =
    activeTab === 'add' && estimatedTokenAAmount !== null
      ? tokenABalanceData.value >= estimatedTokenAAmount
      : true;
  const hasBalance = hasTokenBBalance && hasTokenABalance;

  const isValidForm =
    tokenA &&
    tokenB &&
    feeToken &&
    parsedAmount > 0n &&
    hasBalance &&
    tokenA.address !== tokenB.address &&
    !isSubmitting;

  // ---------------------------------------------------------------------------
  // Pool data fetching
  // ---------------------------------------------------------------------------

  const fetchPoolData = useCallback(async () => {
    if (!tokenA || !tokenB || !address) {
      setPoolInfo(null);
      setLpBalance(0n);
      return;
    }
    setIsLoadingPool(true);
    try {
      const [pool, balance] = await Promise.all([
        getPoolInfo(tokenA.address, tokenB.address),
        getLiquidityBalance(tokenA.address, tokenB.address, address),
      ]);
      console.log('[Liquidity] Pool query:', {
        userToken: tokenA.address,
        validatorToken: tokenB.address,
      });
      console.log('[Liquidity] Pool info:', pool);
      console.log('[Liquidity] LP balance (raw):', balance?.toString());
      setPoolInfo(pool);
      setLpBalance(balance);
    } catch (err) {
      console.error('[Liquidity] Failed to fetch pool data:', err);
      setPoolInfo(null);
      setLpBalance(0n);
    } finally {
      setIsLoadingPool(false);
    }
  }, [tokenA, tokenB, address]);

  // Fetch on token change
  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  // Auto-refresh
  useEffect(() => {
    if (!tokenA || !tokenB || !address) return;
    const interval = setInterval(fetchPoolData, TIMING.POOL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [tokenA, tokenB, address, fetchPoolData]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleTokenAChange = useCallback(
    (t: Token) => {
      if (tokenB && t.address === tokenB.address) setTokenB(tokenA);
      setTokenA(t);
      setAmount('');
    },
    [tokenA, tokenB]
  );

  const handleTokenBChange = useCallback(
    (t: Token) => {
      if (tokenA && t.address === tokenA.address) setTokenA(tokenB);
      setTokenB(t);
      setAmount('');
    },
    [tokenA, tokenB]
  );

  const handleAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAmount(cleaned);
  }, []);

  const handleSetMax = useCallback(() => {
    if (activeTab === 'add') {
      if (tokenBBalanceData.value > 0n && tokenB) {
        setAmount(formatAmount(tokenBBalanceData.value, tokenB.decimals, tokenB.decimals));
      }
    } else {
      if (lpBalance > 0n) {
        setAmount(formatAmount(lpBalance, 18, 18));
      }
    }
  }, [activeTab, tokenBBalanceData.value, tokenB, lpBalance]);

  const handleSubmit = useCallback(async () => {
    if (!isValidForm || !tokenA || !tokenB || !feeToken) return;

    setIsSubmitting(true);
    setTxHash(null);
    try {
      let hash: string;
      if (activeTab === 'add') {
        hash = await addLiquidity({
          userTokenAddress: tokenA.address,
          validatorTokenAddress: tokenB.address,
          validatorTokenAmount: parsedAmount,
          feeToken: feeToken.address,
        });
      } else {
        hash = await removeLiquidity({
          userTokenAddress: tokenA.address,
          validatorTokenAddress: tokenB.address,
          liquidity: parsedAmount,
          feeToken: feeToken.address,
        });
      }
      // Verify the transaction actually succeeded on-chain
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash);
      setAmount('');
      toast.success(
        activeTab === 'add' ? 'Liquidity added successfully' : 'Liquidity removed successfully'
      );
      fetchPoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to ${activeTab} liquidity`, {
        description: message.length > 120 ? 'Please try again or check explorer.' : message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidForm,
    activeTab,
    tokenA,
    tokenB,
    feeToken,
    parsedAmount,
    addLiquidity,
    removeLiquidity,
    fetchPoolData,
  ]);

  if (!address || !tokenA || !tokenB || !feeToken) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-md space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Liquidity</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Provide liquidity to pools and earn fees from trades.
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
      >
        {/* Tab Switcher */}
        <div className="flex border-b border-[#EDE9E3]">
          <button
            onClick={() => {
              setActiveTab('add');
              setTxHash(null);
              setAmount('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[14px] font-semibold transition-all ${
              activeTab === 'add'
                ? 'text-[#5B9A6F] border-b-2 border-[#5B9A6F] bg-[#5B9A6F]/[0.04]'
                : 'text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
          <button
            onClick={() => {
              setActiveTab('remove');
              setTxHash(null);
              setAmount('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[14px] font-semibold transition-all ${
              activeTab === 'remove'
                ? 'text-[#E07A5F] border-b-2 border-[#E07A5F] bg-[#E07A5F]/[0.04]'
                : 'text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED]'
            }`}
          >
            <Minus className="w-4 h-4" />
            Remove
          </button>
        </div>

        <div className="p-5">
          {/* Pool Selection */}
          <div className="mb-4">
            <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
              Select Pool
            </span>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <label className="text-[11px] text-[#9B9590] mb-1 block">Token A</label>
                <TokenPicker
                  token={tokenA}
                  tokens={tokens}
                  onChange={handleTokenAChange}
                  accentColor={activeTab === 'add' ? '#5B9A6F' : '#E07A5F'}
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-[#9B9590] mb-1 block">Token B</label>
                <TokenPicker
                  token={tokenB}
                  tokens={tokens}
                  onChange={handleTokenBChange}
                  accentColor={activeTab === 'add' ? '#5B9A6F' : '#E07A5F'}
                />
              </div>
            </div>
          </div>

          {/* Pool Info Inline */}
          {tokenA && tokenB && (
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5 mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Droplets className="w-3.5 h-3.5 text-[#9B72CF]" />
                <span className="text-[12px] font-semibold text-[#2D3436]">
                  {tokenA.symbol}/{tokenB.symbol} Pool
                </span>
              </div>
              {isLoadingPool ? (
                <div className="flex items-center gap-2 text-[12px] text-[#9B9590]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading pool...
                </div>
              ) : poolInfo ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#9B9590]">Reserves ({tokenA.symbol})</span>
                    <span className="font-medium text-[#2D3436]">
                      {formatAmount(poolInfo.reserveUserToken, tokenA.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#9B9590]">Reserves ({tokenB.symbol})</span>
                    <span className="font-medium text-[#2D3436]">
                      {formatAmount(poolInfo.reserveValidatorToken, tokenB.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#9B9590]">Total LP Supply</span>
                    <span className="font-medium text-[#2D3436]">
                      {formatAmount(poolInfo.totalSupply, 18, 8)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px] pt-1.5 border-t border-[#EDE9E3]">
                    <span className="text-[#9B9590]">Your LP Balance</span>
                    <span className="font-semibold text-[#2D3436]">
                      {lpBalance > 0n && lpBalance < 10n ** 10n
                        ? `~${lpBalance.toString()} wei`
                        : formatAmount(lpBalance, 18, 8)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  No pool found. It will be created when you add liquidity.
                </div>
              )}
            </div>
          )}

          {/* Amount Input — Token B */}
          <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                {activeTab === 'add' ? `${tokenB.symbol} to Deposit` : 'LP Tokens to Remove'}
              </span>
              <button
                type="button"
                onClick={handleSetMax}
                className="text-[11px] text-[#9B9590] hover:text-[#6B6560] transition-colors"
              >
                {activeTab === 'add' ? (
                  <>
                    Balance:{' '}
                    {isTokenBBalanceLoading
                      ? '...'
                      : formatAmount(tokenBBalanceData.value, tokenB.decimals)}
                  </>
                ) : (
                  <>LP Balance: {formatAmount(lpBalance, 18, 8)}</>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 text-[24px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
              />
              <span className="text-[14px] font-medium text-[#9B9590] shrink-0">
                {activeTab === 'add' ? tokenB.symbol : 'LP'}
              </span>
            </div>

            {/* Insufficient Token B balance warning */}
            {amount && parsedAmount > 0n && !hasTokenBBalance && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Insufficient {activeTab === 'add' ? tokenB.symbol : 'LP'} balance</span>
              </motion.div>
            )}
          </div>

          {/* Estimated Token A cost (shown when adding to existing pool) */}
          {activeTab === 'add' && parsedAmount > 0n && (
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  {tokenA.symbol} {poolInfo ? 'Required (estimated)' : 'Balance'}
                </span>
                <span className="text-[11px] text-[#9B9590]">
                  Balance:{' '}
                  {isTokenABalanceLoading
                    ? '...'
                    : formatAmount(tokenABalanceData.value, tokenA.decimals)}
                </span>
              </div>
              {estimatedTokenAAmount !== null ? (
                <p className="text-[22px] font-bold text-[#2D3436]">
                  {formatAmount(estimatedTokenAAmount, tokenA.decimals, tokenA.decimals)}
                </p>
              ) : (
                <p className="text-[13px] text-[#9B9590]">
                  {poolInfo
                    ? 'Enter a Token B amount to see estimate'
                    : 'New pool. The contract will determine the ratio.'}
                </p>
              )}
              {estimatedTokenAAmount !== null && !hasTokenABalance && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Insufficient {tokenA.symbol} balance</span>
                </motion.div>
              )}
            </div>
          )}

          {/* Info callout */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] mb-4">
            <Info className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#6B6560] leading-relaxed">
              {activeTab === 'add'
                ? poolInfo
                  ? `Both ${tokenA.symbol} and ${tokenB.symbol} will be deposited based on the current pool ratio.`
                  : `This is a new pool. Both ${tokenA.symbol} and ${tokenB.symbol} will be deposited. Make sure you have sufficient balance of both tokens.`
                : `Removing liquidity returns both ${tokenA.symbol} and ${tokenB.symbol} proportional to your share of the pool.`}
            </p>
          </div>

          {/* Fee token */}
          <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5 mb-4">
            <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!isValidForm}
            className={`w-full h-12 rounded-xl text-[14px] font-semibold text-white ${
              activeTab === 'add'
                ? 'bg-[#5B9A6F] hover:bg-[#4E8A62]'
                : 'bg-[#E07A5F] hover:bg-[#D06A4F]'
            } disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA]`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {activeTab === 'add' ? 'Adding Liquidity...' : 'Removing Liquidity...'}
              </>
            ) : !amount || parsedAmount === 0n ? (
              'Enter an amount'
            ) : !hasTokenBBalance ? (
              `Insufficient ${activeTab === 'add' ? tokenB.symbol : 'LP'} balance`
            ) : !hasTokenABalance ? (
              `Insufficient ${tokenA.symbol} balance`
            ) : (
              <>
                {activeTab === 'add' ? (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" /> Add Liquidity
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4 mr-1.5" /> Remove Liquidity
                  </>
                )}
              </>
            )}
          </Button>

          {/* Transaction Success */}
          <AnimatePresence>
            {txHash && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-[#5B9A6F]/[0.08] border border-[#5B9A6F]/20"
              >
                <CheckCircle className="w-5 h-5 text-[#5B9A6F] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#2D3436]">Transaction confirmed</p>
                  <p className="text-[12px] text-[#6B6560] font-mono truncate mt-0.5">{txHash}</p>
                </div>
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5B9A6F] hover:text-[#4E8A62] transition-colors shrink-0"
                >
                  View
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
