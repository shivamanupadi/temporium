import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Plus,
  Minus,
  Loader2,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  Check,
  CheckCircle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { TokenPicker } from '@/components/TokenPicker';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';
import { tempoChain } from '@/lib/tempo-client';
import { formatAmount, parseAmount, copyToClipboard } from '@/lib/utils';
import {
  getPoolInfo,
  getLiquidityBalance,
  getExplorerTxUrl,
  waitForTx,
  type PoolInfo,
} from '@/lib/tempo-client';

interface LiquiditySearch {
  user?: string;
  validator?: string;
}

export const Route = createFileRoute('/portal/fee-amm-liquidity')({
  component: LiquidityPage,
  validateSearch: (search: Record<string, unknown>): LiquiditySearch => ({
    user: typeof search.user === 'string' ? search.user : undefined,
    validator: typeof search.validator === 'string' ? search.validator : undefined,
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStep = 'idle' | 'pending' | 'success';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function LiquidityPage(): ReactElement | null {
  const { address, addLiquidity, removeLiquidity } = useTempo();
  const { tokens, isLoading: isLoadingTokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { user, validator } = Route.useSearch();
  const navigate = useNavigate();

  // Token selection
  const [userToken, setUserToken] = useState<Token | null>(null);
  const [validatorToken, setValidatorToken] = useState<Token | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);

  // Initialize tokens from URL search params or defaults
  useEffect(() => {
    if (tokens.length >= 2 && !userToken) {
      const userFromUrl = user
        ? tokens.find(t => t.address.toLowerCase() === user.toLowerCase())
        : null;
      const validatorFromUrl = validator
        ? tokens.find(t => t.address.toLowerCase() === validator.toLowerCase())
        : null;
      const defaultUser = userFromUrl ?? tokens.find(t => t.symbol === 'AlphaUSD') ?? tokens[0];
      const defaultValidator =
        validatorFromUrl ?? tokens.find(t => t.address !== defaultUser.address) ?? tokens[1];
      setUserToken(defaultUser);
      setValidatorToken(defaultValidator);
    }
  }, [tokens, userToken, user, validator]);

  // Fee token priority: user on-chain preference > chain default > first token
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
  const [addAmount, setAddAmount] = useState('');
  const [removeAmount, setRemoveAmount] = useState('');

  // Dialog flow state
  const [step, setStep] = useState<FlowStep>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'add' | 'remove'>('add');
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Pool info & LP balance
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  // Token balances
  const { data: validatorBalanceData, isLoading: isLoadingValidatorBalance } = useTokenBalance(
    validatorToken?.address,
    address
  );
  useTokenBalance(userToken?.address, address);

  // Decimals
  const validatorDecimals = validatorToken?.decimals ?? 6;
  const userDecimals = userToken?.decimals ?? 6;

  // Parsed amounts
  const parsedAddAmount = parseAmount(addAmount, validatorDecimals);
  const parsedRemoveAmount = parseAmount(removeAmount, 18);

  // Validation — independent for add and remove
  const hasAddBalance = validatorBalanceData.value >= parsedAddAmount;
  const hasRemoveBalance = lpBalance >= parsedRemoveAmount;

  const isValidAdd =
    !!userToken &&
    !!validatorToken &&
    !!feeToken &&
    parsedAddAmount > 0n &&
    hasAddBalance &&
    userToken.address !== validatorToken.address &&
    step === 'idle';

  const isValidRemove =
    !!userToken &&
    !!validatorToken &&
    !!feeToken &&
    parsedRemoveAmount > 0n &&
    hasRemoveBalance &&
    userToken.address !== validatorToken.address &&
    step === 'idle';

  // Your pool share percentage
  const poolSharePct =
    poolInfo && poolInfo.totalSupply > 0n && lpBalance > 0n
      ? Number((lpBalance * 10000n) / poolInfo.totalSupply) / 100
      : 0;

  // Estimated receive on remove (pro-rata)
  const estimatedRemoveUser =
    poolInfo && poolInfo.totalSupply > 0n && parsedRemoveAmount > 0n
      ? (parsedRemoveAmount * poolInfo.reserveUserToken) / poolInfo.totalSupply
      : null;
  const estimatedRemoveValidator =
    poolInfo && poolInfo.totalSupply > 0n && parsedRemoveAmount > 0n
      ? (parsedRemoveAmount * poolInfo.reserveValidatorToken) / poolInfo.totalSupply
      : null;

  // Estimated value of full position
  const positionValueUser =
    poolInfo && poolInfo.totalSupply > 0n && lpBalance > 0n
      ? (lpBalance * poolInfo.reserveUserToken) / poolInfo.totalSupply
      : null;
  const positionValueValidator =
    poolInfo && poolInfo.totalSupply > 0n && lpBalance > 0n
      ? (lpBalance * poolInfo.reserveValidatorToken) / poolInfo.totalSupply
      : null;

  // Store the submitted amount for display in the dialog
  const [submittedAmount, setSubmittedAmount] = useState('');

  // ---------------------------------------------------------------------------
  // Pool data fetching
  // ---------------------------------------------------------------------------

  const fetchPoolData = useCallback(async () => {
    if (!userToken || !validatorToken || !address) {
      setPoolInfo(null);
      setLpBalance(0n);
      return;
    }
    setIsLoadingPool(true);
    try {
      const [pool, balance] = await Promise.all([
        getPoolInfo(userToken.address, validatorToken.address),
        getLiquidityBalance(userToken.address, validatorToken.address, address),
      ]);
      setPoolInfo(pool);
      setLpBalance(balance);
    } catch {
      setPoolInfo(null);
      setLpBalance(0n);
    } finally {
      setIsLoadingPool(false);
    }
  }, [userToken, validatorToken, address]);

  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  useEffect(() => {
    if (!userToken || !validatorToken || !address) return;
    const interval = setInterval(fetchPoolData, TIMING.POOL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [userToken, validatorToken, address, fetchPoolData]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateSearchParams = useCallback(
    (u: Token | null, v: Token | null) => {
      navigate({
        to: '/portal/fee-amm-liquidity',
        search: { user: u?.address, validator: v?.address },
        replace: true,
      });
    },
    [navigate]
  );

  const handleUserTokenChange = useCallback(
    (t: Token) => {
      const newValidator =
        validatorToken && t.address === validatorToken.address ? userToken : validatorToken;
      if (validatorToken && t.address === validatorToken.address) setValidatorToken(userToken);
      setUserToken(t);
      setAddAmount('');
      setRemoveAmount('');
      updateSearchParams(t, newValidator);
    },
    [userToken, validatorToken, updateSearchParams]
  );

  const handleValidatorTokenChange = useCallback(
    (t: Token) => {
      const newUser = userToken && t.address === userToken.address ? validatorToken : userToken;
      if (userToken && t.address === userToken.address) setUserToken(validatorToken);
      setValidatorToken(t);
      setAddAmount('');
      setRemoveAmount('');
      updateSearchParams(newUser, t);
    },
    [userToken, validatorToken, updateSearchParams]
  );

  const handleAddAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setAddAmount(cleaned);
  }, []);

  const handleRemoveAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    setRemoveAmount(cleaned);
  }, []);

  const handleSetMaxAdd = useCallback(() => {
    if (validatorBalanceData.value > 0n && validatorToken) {
      setAddAmount(formatAmount(validatorBalanceData.value, validatorDecimals, validatorDecimals));
    }
  }, [validatorBalanceData.value, validatorToken, validatorDecimals]);

  const handleSetMaxRemove = useCallback(() => {
    if (lpBalance > 0n) {
      setRemoveAmount(formatAmount(lpBalance, 18, 18));
    }
  }, [lpBalance]);

  const handleAddSubmit = useCallback(async () => {
    if (!isValidAdd || !userToken || !validatorToken || !feeToken) return;

    setSubmittedAmount(addAmount);
    setStep('pending');
    setTxHash(null);
    setLastAction('add');
    setCopied(false);
    try {
      const hash = await addLiquidity({
        userTokenAddress: userToken.address,
        validatorTokenAddress: validatorToken.address,
        validatorTokenAmount: parsedAddAmount,
        feeToken: feeToken.address,
      });
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash);
      setAddAmount('');
      setStep('success');
      fetchPoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to add liquidity', {
        description: message.length > 120 ? 'Please try again or check explorer.' : message,
      });
      setStep('idle');
    }
  }, [
    isValidAdd,
    userToken,
    validatorToken,
    feeToken,
    addAmount,
    parsedAddAmount,
    addLiquidity,
    fetchPoolData,
  ]);

  const handleRemoveSubmit = useCallback(async () => {
    if (!isValidRemove || !userToken || !validatorToken || !feeToken) return;

    setSubmittedAmount(removeAmount);
    setStep('pending');
    setTxHash(null);
    setLastAction('remove');
    setCopied(false);
    try {
      const hash = await removeLiquidity({
        userTokenAddress: userToken.address,
        validatorTokenAddress: validatorToken.address,
        liquidity: parsedRemoveAmount,
        feeToken: feeToken.address,
      });
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash);
      setRemoveAmount('');
      setStep('success');
      fetchPoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to remove liquidity', {
        description: message.length > 120 ? 'Please try again or check explorer.' : message,
      });
      setStep('idle');
    }
  }, [
    isValidRemove,
    userToken,
    validatorToken,
    feeToken,
    removeAmount,
    parsedRemoveAmount,
    removeLiquidity,
    fetchPoolData,
  ]);

  const handleCopyTxHash = useCallback(async () => {
    if (!txHash) return;
    const ok = await copyToClipboard(txHash);
    if (ok) {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [txHash]);

  const handleDialogClose = useCallback(() => {
    if (step === 'pending') return; // prevent closing during tx
    setStep('idle');
    setTxHash(null);
    setCopied(false);
    setSubmittedAmount('');
  }, [step]);

  if (!address) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const accentColor = lastAction === 'add' ? '#6B8F71' : '#E07A5F';
  const accentHover = lastAction === 'add' ? '#5A7D60' : '#D06A4F';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Fee AMM Liquidity</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Provide liquidity to the Fee AMM and earn 0.3% on fee conversions.
        </p>
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

      {/* Main content — always shows the form */}
      {userToken && validatorToken && feeToken && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Pool Selection + Pool Info — single card */}
          <div className="rounded-2xl border border-[#EDE9E3] bg-white p-5">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              {/* Pool Selection */}
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                  Select Pool
                </span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-[#9B9590] mb-1 block">User Token</label>
                    <TokenPicker
                      token={userToken}
                      tokens={tokens}
                      disabledAddresses={[validatorToken.address]}
                      onChange={handleUserTokenChange}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-[#9B9590] mb-1 block">Validator Token</label>
                    <TokenPicker
                      token={validatorToken}
                      tokens={tokens}
                      disabledAddresses={[userToken.address]}
                      onChange={handleValidatorTokenChange}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px self-stretch bg-[#EDE9E3]" />
              <div className="md:hidden border-t border-[#EDE9E3]" />

              {/* Pool Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <Droplets className="w-3.5 h-3.5 text-[#6B8F71]" />
                  <span className="text-[12px] font-semibold text-[#2D3436]">
                    {userToken.symbol} / {validatorToken.symbol} Pool
                  </span>
                </div>
                {isLoadingPool ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">{userToken.symbol} Reserve</span>
                      <span className="h-4 w-16 rounded bg-[#EDE9E3] animate-pulse" />
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">{validatorToken.symbol} Reserve</span>
                      <span className="h-4 w-20 rounded bg-[#EDE9E3] animate-pulse" />
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">Total LP Supply</span>
                      <span className="h-4 w-14 rounded bg-[#EDE9E3] animate-pulse" />
                    </div>
                  </div>
                ) : poolInfo ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">{userToken.symbol} Reserve</span>
                      <span className="font-medium text-[#2D3436]">
                        {formatAmount(poolInfo.reserveUserToken, userDecimals)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">{validatorToken.symbol} Reserve</span>
                      <span className="font-medium text-[#2D3436]">
                        {formatAmount(poolInfo.reserveValidatorToken, validatorDecimals)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9B9590]">Total LP Supply</span>
                      <span className="font-medium text-[#2D3436]">
                        {formatAmount(poolInfo.totalSupply, 18, 8)}
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
            </div>
          </div>

          {/* Bottom row: Add Liquidity + Remove Liquidity side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Add Liquidity Section */}
            <div className="rounded-2xl border border-[#EDE9E3] bg-white p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#6B8F71]" />
                <span className="text-[13px] font-semibold text-[#2D3436]">Add Liquidity</span>
              </div>

              {/* Info callout */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#6B8F71]/[0.05] border border-[#6B8F71]/[0.12]">
                <Info className="w-4 h-4 text-[#6B8F71] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#6B6560] leading-relaxed">
                  Deposit {validatorToken.symbol} to provide liquidity. User token reserves are
                  filled automatically through fee conversions. You earn 0.3% on each conversion.
                </p>
              </div>

              {/* Deposit Input */}
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    {validatorToken.symbol} to Deposit
                  </span>
                  <button
                    type="button"
                    onClick={handleSetMaxAdd}
                    className="text-[11px] text-[#9B9590] hover:text-[#6B8F71] transition-colors"
                  >
                    Balance:{' '}
                    {isLoadingValidatorBalance
                      ? '...'
                      : formatAmount(validatorBalanceData.value, validatorDecimals)}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={addAmount}
                    onChange={e => handleAddAmountChange(e.target.value)}
                    disabled={step !== 'idle'}
                    className="flex-1 text-[24px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                  />
                  <span className="text-[14px] font-medium text-[#9B9590] shrink-0">
                    {validatorToken.symbol}
                  </span>
                </div>
                {addAmount && parsedAddAmount > 0n && !hasAddBalance && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Insufficient {validatorToken.symbol} balance</span>
                  </motion.div>
                )}
              </div>

              {/* Fee token */}
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>

              {/* Add button */}
              <Button
                onClick={handleAddSubmit}
                disabled={!isValidAdd}
                className="w-full h-12 rounded-xl text-[14px] font-semibold text-white bg-[#6B8F71] hover:bg-[#5A7D60] disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA] mt-auto"
              >
                {!addAmount || parsedAddAmount === 0n ? (
                  'Enter an amount'
                ) : !hasAddBalance ? (
                  `Insufficient ${validatorToken.symbol} balance`
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" /> Add Liquidity
                  </>
                )}
              </Button>
            </div>

            {/* Remove Liquidity Card — always visible */}
            <div className="rounded-2xl border border-[#EDE9E3] bg-white p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Minus className="w-4 h-4 text-[#E07A5F]" />
                <span className="text-[13px] font-semibold text-[#2D3436]">Remove Liquidity</span>
              </div>

              {/* Position details */}
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5 space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9B9590]">Your LP Balance</span>
                  <span className="font-semibold text-[#2D3436]">
                    {lpBalance > 0n && lpBalance < 10n ** 10n
                      ? `~${lpBalance.toString()} wei`
                      : formatAmount(lpBalance, 18, 8)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9B9590]">Pool Share</span>
                  <span className="font-semibold text-[#6B8F71]">
                    {poolSharePct > 0
                      ? `${poolSharePct < 0.01 ? '<0.01' : poolSharePct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9B9590]">Est. {userToken.symbol}</span>
                  <span className="font-medium text-[#2D3436]">
                    {positionValueUser !== null
                      ? formatAmount(positionValueUser, userDecimals)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9B9590]">Est. {validatorToken.symbol}</span>
                  <span className="font-medium text-[#2D3436]">
                    {positionValueValidator !== null
                      ? formatAmount(positionValueValidator, validatorDecimals)
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Remove input */}
              <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    LP Tokens to Remove
                  </span>
                  <button
                    type="button"
                    onClick={handleSetMaxRemove}
                    className="text-[11px] text-[#9B9590] hover:text-[#E07A5F] transition-colors"
                  >
                    LP Balance: {formatAmount(lpBalance, 18, 8)}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={removeAmount}
                    onChange={e => handleRemoveAmountChange(e.target.value)}
                    disabled={step !== 'idle'}
                    className="flex-1 text-[24px] font-bold text-[#2D3436] bg-transparent border-none outline-none placeholder:text-[#D5D0CA] min-w-0"
                  />
                  <span className="text-[14px] font-medium text-[#9B9590] shrink-0">LP</span>
                </div>
                {removeAmount && parsedRemoveAmount > 0n && !hasRemoveBalance && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-[#D35D3A]"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Insufficient LP balance</span>
                  </motion.div>
                )}
              </div>

              {/* Estimated receive on remove */}
              <AnimatePresence>
                {estimatedRemoveUser !== null && estimatedRemoveValidator !== null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-4 space-y-2">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        You will receive (estimated)
                      </span>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-[#6B6560]">{userToken.symbol}</span>
                        <span className="font-bold text-[#2D3436]">
                          {formatAmount(estimatedRemoveUser, userDecimals)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-[#6B6560]">{validatorToken.symbol}</span>
                        <span className="font-bold text-[#2D3436]">
                          {formatAmount(estimatedRemoveValidator, validatorDecimals)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Remove button */}
              <Button
                onClick={handleRemoveSubmit}
                disabled={!isValidRemove}
                className="w-full h-12 rounded-xl text-[14px] font-semibold text-white bg-[#E07A5F] hover:bg-[#D06A4F] disabled:bg-[#EDE9E3] disabled:text-[#B5B0AA] mt-auto"
              >
                {!removeAmount || parsedRemoveAmount === 0n ? (
                  'Enter an amount'
                ) : !hasRemoveBalance ? (
                  'Insufficient LP balance'
                ) : (
                  <>
                    <Minus className="w-4 h-4 mr-1.5" /> Remove Liquidity
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* Pending / Success Dialog                                           */}
      {/* ================================================================= */}
      <Dialog
        open={step !== 'idle'}
        onOpenChange={(open: boolean) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent
          hideClose={step === 'pending'}
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl"
        >
          <AnimatePresence mode="wait">
            {/* ─── Pending Step ───────────────────────────────────── */}
            {step === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">Processing</DialogTitle>
                <DialogDescription className="sr-only">
                  Your liquidity transaction is being processed
                </DialogDescription>

                {/* Background glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <motion.div
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.15, 0.3, 0.15],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute -top-16 -left-16 w-48 h-48 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
                    }}
                  />
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.1, 0.25, 0.1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.5,
                    }}
                    className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${accentColor}26 0%, transparent 70%)`,
                    }}
                  />
                </div>

                <div className="relative px-6 py-14 text-center">
                  {/* Spinner */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="absolute w-16 h-16"
                    >
                      <svg viewBox="0 0 64 64" className="w-full h-full">
                        <circle
                          cx="32"
                          cy="32"
                          r="30"
                          fill="none"
                          stroke={accentColor}
                          strokeWidth="1.5"
                          strokeDasharray="50 140"
                          strokeLinecap="round"
                          opacity="0.5"
                        />
                      </svg>
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}1A` }}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                      {lastAction === 'add' ? 'Adding Liquidity' : 'Removing Liquidity'}
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {submittedAmount}
                      <span className="text-lg font-semibold text-[#9B9590] ml-2">
                        {lastAction === 'add' ? validatorToken?.symbol : 'LP'}
                      </span>
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F2ED]"
                  >
                    <Droplets className="w-3 h-3 text-[#9B9590]" />
                    <span className="text-[11px] text-[#6B6560]">
                      {userToken?.symbol} / {validatorToken?.symbol} pool
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ─── Success Step ───────────────────────────────────── */}
            {step === 'success' && txHash && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">
                  {lastAction === 'add' ? 'Liquidity Added' : 'Liquidity Removed'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Your liquidity transaction has been completed
                </DialogDescription>

                <div className="px-6 pt-10 pb-6 text-center">
                  {/* Success icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                    }}
                    className="inline-flex items-center justify-center mb-6"
                  >
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}
                    >
                      <svg
                        width="32"
                        height="32"
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
                          transition={{
                            duration: 0.4,
                            delay: 0.3,
                            ease: 'easeOut',
                          }}
                        />
                      </svg>
                    </div>
                  </motion.div>

                  {/* Title */}
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-[15px] font-bold text-[#2D3436] mb-1"
                  >
                    {lastAction === 'add' ? 'Liquidity Added' : 'Liquidity Removed'}
                  </motion.p>

                  {/* Amount */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mb-6"
                  >
                    <span className="text-3xl font-bold text-[#2D3436]">{submittedAmount}</span>
                    <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                      {lastAction === 'add' ? validatorToken?.symbol : 'LP'}
                    </span>
                  </motion.div>

                  {/* Details card */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left"
                  >
                    {/* Pool */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Pool
                      </span>
                      <span className="text-[12px] font-medium text-[#2D3436] flex items-center gap-1.5">
                        <Droplets className="w-3 h-3 text-[#6B8F71]" />
                        {userToken?.symbol} / {validatorToken?.symbol}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Action
                      </span>
                      <span
                        className="text-[12px] font-medium flex items-center gap-1"
                        style={{ color: accentColor }}
                      >
                        {lastAction === 'add' ? (
                          <>
                            <Plus className="w-3 h-3" /> Deposit
                          </>
                        ) : (
                          <>
                            <Minus className="w-3 h-3" /> Withdraw
                          </>
                        )}
                      </span>
                    </div>

                    {/* Tx hash */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                        Tx Hash
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] text-[#2D3436]">
                          {txHash.slice(0, 10)}...{txHash.slice(-4)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyTxHash}
                          className="p-1 rounded-md hover:bg-[#F5F2ED] transition-colors"
                          title="Copy transaction hash"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-[#6B8F71]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#9B9590]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Footer actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="px-6 pb-6 flex gap-3"
                >
                  <Button
                    variant="outline"
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Explorer
                  </Button>
                  <Button
                    onClick={handleDialogClose}
                    className="flex-1 h-11 rounded-xl font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = accentHover)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = accentColor)}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Done
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
