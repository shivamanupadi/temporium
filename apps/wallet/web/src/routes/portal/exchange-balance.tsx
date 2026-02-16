import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowDownToLine,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  Info,
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
import { tempoChain, waitForTx } from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';
import { getDexBalance, getExplorerTxUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/exchange-balance')({
  component: ExchangeBalancePage,
});

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
// Page
// ---------------------------------------------------------------------------

interface DexTokenBalance {
  token: Token;
  dexBalance: bigint;
  isLoading: boolean;
}

function ExchangeBalancePage(): ReactElement | null {
  const { address, dexWithdraw } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

  // DEX balances for all tokens
  const [dexBalances, setDexBalances] = useState<DexTokenBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Withdraw form
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Default tokens
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) setSelectedToken(tokens[0]);
  }, [tokens, selectedToken]);

  // Fee token priority: user on-chain preference > chain default (AlphaUSD) > first token
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

  // Fetch all DEX balances
  const fetchDexBalances = useCallback(async () => {
    if (!address || tokens.length === 0) return;
    setIsLoadingBalances(true);
    try {
      const results = await Promise.all(
        tokens.map(async token => {
          const dexBalance = await getDexBalance(token.address, address);
          return { token, dexBalance, isLoading: false };
        })
      );
      setDexBalances(results);
    } catch {
      // Keep existing balances on error
    } finally {
      setIsLoadingBalances(false);
    }
  }, [address, tokens]);

  useEffect(() => {
    fetchDexBalances();
  }, [fetchDexBalances]);

  // Auto-refresh
  useEffect(() => {
    if (!address || tokens.length === 0) return;
    const interval = setInterval(fetchDexBalances, TIMING.BALANCE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [address, tokens, fetchDexBalances]);

  // Selected token's DEX balance
  const selectedDexBalance =
    dexBalances.find(b => b.token.address === selectedToken?.address)?.dexBalance ?? 0n;

  // Wallet balance for selected token
  const { data: walletBalanceData } = useTokenBalance(selectedToken?.address, address);

  const tokenDecimals = selectedToken?.decimals ?? 6;
  const parsedWithdrawAmount = parseAmount(withdrawAmount, tokenDecimals);
  const hasEnoughDexBalance = selectedDexBalance >= parsedWithdrawAmount;
  const hasNonZeroDexBalance = dexBalances.some(b => b.dexBalance > 0n);

  const canWithdraw =
    selectedToken && feeToken && parsedWithdrawAmount > 0n && hasEnoughDexBalance && !isWithdrawing;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setWithdrawAmount(cleaned);
  }, []);

  const handleSetMax = useCallback(() => {
    if (selectedDexBalance > 0n && selectedToken) {
      setWithdrawAmount(
        formatAmount(selectedDexBalance, selectedToken.decimals, selectedToken.decimals)
      );
    }
  }, [selectedDexBalance, selectedToken]);

  const handleWithdraw = useCallback(async () => {
    if (!canWithdraw || !selectedToken || !feeToken) return;

    setIsWithdrawing(true);
    setTxHash(null);
    try {
      const hash = await dexWithdraw({
        token: selectedToken.address,
        amount: parsedWithdrawAmount,
        feeToken: feeToken.address,
      });
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash);
      setWithdrawAmount('');
      toast.success('Withdrawal successful', {
        description: `${formatAmount(parsedWithdrawAmount, tokenDecimals)} ${selectedToken.symbol} withdrawn to your wallet.`,
      });
      fetchDexBalances();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Withdrawal failed', {
        description: message.length > 120 ? 'Please try again or check explorer.' : message,
      });
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    canWithdraw,
    selectedToken,
    feeToken,
    parsedWithdrawAmount,
    tokenDecimals,
    dexWithdraw,
    fetchDexBalances,
  ]);

  if (!address) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Exchange Balance</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          View and withdraw your tokens held on the DEX orderbook.
        </p>
      </motion.div>

      {/* DEX Balances Overview */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE9E3]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#9B72CF]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#2D3436]">DEX Balances</h2>
              <p className="text-[12px] text-[#9B9590]">Tokens held in the orderbook exchange</p>
            </div>
          </div>
          <button
            onClick={fetchDexBalances}
            disabled={isLoadingBalances}
            className="p-2 rounded-lg text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-4">
          {isLoadingBalances && dexBalances.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#9B9590]" />
              <span className="text-[13px] text-[#9B9590]">Loading DEX balances...</span>
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#9B9590]">No tokens available</div>
          ) : !hasNonZeroDexBalance && dexBalances.length > 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-6 h-6 text-[#B5B0AA]" />
              </div>
              <p className="text-[14px] font-medium text-[#6B6560]">No DEX balances</p>
              <p className="text-[12px] text-[#9B9590] mt-1 max-w-xs mx-auto">
                Tokens appear here when you have filled orders or unclaimed balances on the
                exchange.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dexBalances.map(({ token, dexBalance }) => (
                <div
                  key={token.address}
                  className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
                    dexBalance > 0n
                      ? 'bg-[#9B72CF]/[0.04] border border-[#9B72CF]/10'
                      : 'bg-[#FDFBF8] border border-[#EDE9E3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-[#2D3436]">{token.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-[14px] font-bold ${
                        dexBalance > 0n ? 'text-[#9B72CF]' : 'text-[#B5B0AA]'
                      }`}
                    >
                      {formatAmount(dexBalance, token.decimals)}
                    </p>
                    {dexBalance > 0n && <p className="text-[11px] text-[#9B9590]">on exchange</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Withdraw Card */}
      {selectedToken && feeToken && (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#EDE9E3]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-[#E07A5F]" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#2D3436]">Withdraw to Wallet</h2>
                <p className="text-[12px] text-[#9B9590]">
                  Move tokens from the exchange to your wallet
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Token selector */}
            <div>
              <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                Token
              </label>
              <TokenPicker
                token={selectedToken}
                tokens={tokens}
                onChange={t => {
                  setSelectedToken(t);
                  setWithdrawAmount('');
                  setTxHash(null);
                }}
                accentColor="#E07A5F"
              />
            </div>

            {/* Balance summary */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5 space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-[#9B9590]">DEX Balance</span>
                <span
                  className={`font-semibold ${selectedDexBalance > 0n ? 'text-[#9B72CF]' : 'text-[#B5B0AA]'}`}
                >
                  {formatAmount(selectedDexBalance, tokenDecimals)} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#9B9590]">Wallet Balance</span>
                <span className="font-medium text-[#2D3436]">
                  {formatAmount(walletBalanceData.value, tokenDecimals)} {selectedToken.symbol}
                </span>
              </div>
            </div>

            {/* Amount input */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Withdraw Amount
                </span>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[11px] text-[#9B9590] hover:text-[#6B6560] transition-colors"
                >
                  Max: {formatAmount(selectedDexBalance, tokenDecimals)}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={e => handleAmountChange(e.target.value)}
                  disabled={isWithdrawing || selectedDexBalance === 0n}
                  className="flex-1 text-[24px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0 disabled:opacity-50"
                />
                <span className="text-[14px] font-medium text-[#9B9590] shrink-0">
                  {selectedToken.symbol}
                </span>
              </div>

              {withdrawAmount && parsedWithdrawAmount > 0n && !hasEnoughDexBalance && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Amount exceeds your DEX balance</span>
                </motion.div>
              )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
              <Info className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#6B6560] leading-relaxed">
                Tokens on the exchange come from filled limit orders or cancelled orders. Withdraw
                them to use in your wallet.
              </p>
            </div>

            {/* Fee token */}
            <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5">
              <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
            </div>

            {/* Submit */}
            <Button
              onClick={handleWithdraw}
              disabled={!canWithdraw}
              className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA]"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Withdrawing...
                </>
              ) : selectedDexBalance === 0n ? (
                'No balance to withdraw'
              ) : !withdrawAmount || parsedWithdrawAmount === 0n ? (
                'Enter an amount'
              ) : !hasEnoughDexBalance ? (
                'Exceeds DEX balance'
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                  Withdraw {selectedToken.symbol}
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
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#5B9A6F]/[0.08] border border-[#5B9A6F]/20"
                >
                  <CheckCircle className="w-5 h-5 text-[#5B9A6F] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2D3436]">Withdrawal confirmed</p>
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
      )}
    </motion.div>
  );
}
