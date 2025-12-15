import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Minus,
  Check,
  ExternalLink,
  DollarSign,
  Loader2,
  Droplets,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { formatAmount, parseAmount } from '@/lib/utils';
import { TIMING } from '@/lib/constants';
import {
  getPoolInfo,
  getLiquidityBalance,
  getExplorerTxUrl,
  type PoolInfo,
} from '@/lib/tempo-client';
import type { Address } from 'viem';
import { getTokenColors, type Token } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/liquidity')({
  component: LiquidityPage,
});

type ModalState = 'confirm' | 'pending' | 'success' | null;
type ActionType = 'add' | 'remove';

function LiquidityPage(): ReactElement | null {
  const { address, addLiquidity, removeLiquidity } = useTempo();
  const { tokens } = useTokenList();

  const [userToken, setUserToken] = useState<Token | null>(null);
  const [validatorToken, setValidatorToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>('add');
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  // Set default tokens
  useEffect(() => {
    if (tokens.length >= 2 && !userToken) {
      const defaultUser = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0];
      const defaultValidator = tokens.find(t => t.symbol !== defaultUser.symbol) || tokens[1];
      setUserToken(defaultUser);
      setValidatorToken(defaultValidator);
    }
  }, [tokens, userToken]);

  // Fetch pool info when tokens change
  useEffect(() => {
    if (!userToken || !validatorToken || !address) {
      setPoolInfo(null);
      setLpBalance(0n);
      return;
    }

    let cancelled = false;
    setIsLoadingPool(true);

    const fetchPoolData = async (): Promise<void> => {
      try {
        const [pool, balance] = await Promise.all([
          getPoolInfo(userToken.address, validatorToken.address),
          getLiquidityBalance(userToken.address, validatorToken.address, address),
        ]);
        if (!cancelled) {
          setPoolInfo(pool);
          setLpBalance(balance);
        }
      } catch (err) {
        console.error('Failed to fetch pool data:', err);
      } finally {
        if (!cancelled) {
          setIsLoadingPool(false);
        }
      }
    };

    fetchPoolData();

    const interval = setInterval(fetchPoolData, TIMING.POOL_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userToken, validatorToken, address]);

  const validatorBalance = useTokenBalance(validatorToken?.address as Address);

  if (!address) return null;

  // LP tokens have 18 decimals, stablecoins have 6
  const decimalsToUse = actionType === 'add' ? (validatorToken?.decimals ?? 6) : 18;
  const parsedAmount = parseAmount(amount, decimalsToUse);
  const hasBalance =
    actionType === 'add'
      ? validatorBalance.data?.value && validatorBalance.data.value >= parsedAmount
      : lpBalance >= parsedAmount;

  const isValidForm =
    userToken &&
    validatorToken &&
    parsedAmount > 0n &&
    hasBalance &&
    feeToken &&
    userToken.address !== validatorToken.address;

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !userToken || !validatorToken || !feeToken) return;
    setModalState('pending');
    try {
      let hash: string;
      if (actionType === 'add') {
        hash = await addLiquidity({
          userToken: userToken.address,
          validatorToken: validatorToken.address,
          validatorTokenAmount: parsedAmount,
          feeToken: feeToken.address,
        });
      } else {
        hash = await removeLiquidity({
          userToken: userToken.address,
          validatorToken: validatorToken.address,
          liquidity: parsedAmount,
          feeToken: feeToken.address,
        });
      }
      setTxHash(hash);
      setModalState('success');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to ${actionType} liquidity`, {
        description: errorMessage.slice(0, 100),
      });
      setModalState('confirm');
    }
  };

  const resetForm = (): void => {
    setAmount('');
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
    <div className="max-w-md">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Liquidity</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-5 space-y-4">
        {/* Action Tabs */}
        <Tabs
          value={actionType}
          onValueChange={v => {
            setActionType(v as ActionType);
            setAmount('');
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add
            </TabsTrigger>
            <TabsTrigger value="remove" className="gap-1.5">
              <Minus className="h-3.5 w-3.5" />
              Remove
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Pool Selection */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {/* User Token */}
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Token A
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 w-full h-10 px-3 bg-white border border-gray-200 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {userToken && (
                      <>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: getTokenColors(userToken.symbol).bg }}
                        >
                          <DollarSign
                            className="h-3 w-3"
                            style={{ color: getTokenColors(userToken.symbol).text }}
                          />
                        </div>
                        <span className="text-[13px] font-medium">{userToken.symbol}</span>
                      </>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {tokens.map(token => (
                    <DropdownMenuItem
                      key={token.address}
                      onClick={() => {
                        if (token.address === validatorToken?.address) {
                          setValidatorToken(userToken);
                        }
                        setUserToken(token);
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
                      {userToken?.address === token.address && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Validator Token */}
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Token B
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 w-full h-10 px-3 bg-white border border-gray-200 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {validatorToken && (
                      <>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: getTokenColors(validatorToken.symbol).bg }}
                        >
                          <DollarSign
                            className="h-3 w-3"
                            style={{ color: getTokenColors(validatorToken.symbol).text }}
                          />
                        </div>
                        <span className="text-[13px] font-medium">{validatorToken.symbol}</span>
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
                        if (token.address === userToken?.address) {
                          setUserToken(validatorToken);
                        }
                        setValidatorToken(token);
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
                      {validatorToken?.address === token.address && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Pool Info */}
        {userToken && validatorToken && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-primary" />
              <span className="text-[12px] font-medium text-foreground">
                {userToken.symbol}/{validatorToken.symbol} Pool
              </span>
            </div>
            {isLoadingPool ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading pool...
              </div>
            ) : poolInfo ? (
              <>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Reserves ({userToken.symbol})</span>
                  <span className="text-foreground">
                    {formatAmount(poolInfo.reserveUserToken.toString(), userToken.decimals)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Reserves ({validatorToken.symbol})</span>
                  <span className="text-foreground">
                    {formatAmount(
                      poolInfo.reserveValidatorToken.toString(),
                      validatorToken.decimals
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Total LP Supply</span>
                  <span className="text-foreground">
                    {formatAmount(poolInfo.totalSupply.toString(), 18, 4)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px] pt-1 border-t border-border">
                  <span className="text-muted-foreground">Your LP Balance</span>
                  <span className="text-foreground font-medium">
                    {formatAmount(lpBalance.toString(), 18, 4)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No pool found for this pair
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {actionType === 'add' ? 'Amount to Add' : 'LP Tokens to Remove'}
            </span>
            <button
              onClick={() => {
                if (actionType === 'add' && validatorBalance.data?.value && validatorToken) {
                  setAmount(
                    formatAmount(validatorBalance.data.value.toString(), validatorToken.decimals)
                  );
                } else if (actionType === 'remove' && lpBalance > 0n) {
                  setAmount(formatAmount(lpBalance.toString(), 18, 6));
                }
              }}
              className="text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {actionType === 'add'
                ? `Balance: ${validatorBalance.isLoading ? '...' : formatAmount(validatorBalance.data?.value.toString() || '0', validatorToken?.decimals)}`
                : `LP Balance: ${formatAmount(lpBalance.toString(), 18, 4)}`}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                if (val.split('.').length <= 2) setAmount(val);
              }}
              className="flex-1 text-2xl font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            />
            <span className="text-[14px] font-medium text-muted-foreground">
              {actionType === 'add' ? validatorToken?.symbol : 'LP'}
            </span>
          </div>

          {amount && parsedAmount > 0n && !hasBalance && (
            <p className="text-[11px] text-destructive mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Insufficient balance
            </p>
          )}
        </div>

        <FeeTokenSelector
          value={feeToken}
          onChange={setFeeToken}
          className="pt-2 border-t border-border"
        />

        {/* Submit */}
        <Button
          className="w-full h-11 text-[14px] font-medium"
          disabled={!isValidForm || isLoadingPool}
          onClick={() => setModalState('confirm')}
        >
          {isLoadingPool
            ? 'Loading pool...'
            : `Review ${actionType === 'add' ? 'Add' : 'Remove'} Liquidity`}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent
          hideClose={modalState === 'pending'}
          className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl"
        >
          {/* CONFIRM STATE */}
          {modalState === 'confirm' && userToken && validatorToken && feeToken && (
            <>
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-semibold">
                  {actionType === 'add' ? 'Add Liquidity' : 'Remove Liquidity'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Review the details before confirming
                </DialogDescription>
              </div>

              <div className="px-6 pb-6">
                {/* Amount Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {actionType === 'add' ? (
                          <Plus className="h-5 w-5 text-primary" />
                        ) : (
                          <Minus className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-lg font-semibold text-foreground">
                          {amount} {actionType === 'add' ? validatorToken.symbol : 'LP'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pool Card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Pool</p>
                      <p className="text-sm font-medium text-foreground">
                        {userToken.symbol}/{validatorToken.symbol}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details Card */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Action</span>
                    <span className="text-xs font-medium text-foreground capitalize">
                      {actionType} Liquidity
                    </span>
                  </div>
                  {poolInfo && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Your LP Balance</span>
                      <span className="text-xs font-medium text-foreground">
                        {formatAmount(lpBalance.toString(), 18, 4)} LP
                      </span>
                    </div>
                  )}
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
          {modalState === 'pending' && userToken && validatorToken && (
            <div className="relative overflow-hidden">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing liquidity action</DialogDescription>

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
                        stroke="url(#liquidityPendingGradient)"
                        strokeWidth="1.5"
                        strokeDasharray="50 140"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient
                          id="liquidityPendingGradient"
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
                    {actionType === 'add' ? 'Adding Liquidity' : 'Removing Liquidity'}
                  </p>
                  <p className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
                    {amount}
                    <span className="text-[18px] font-medium text-muted-foreground ml-2">
                      {actionType === 'add' ? validatorToken.symbol : 'LP'}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {userToken.symbol}/{validatorToken.symbol} Pool
                  </p>
                </motion.div>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {modalState === 'success' && txHash && userToken && validatorToken && (
            <div className="relative overflow-hidden bg-white">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Liquidity action completed</DialogDescription>

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
                  Liquidity {actionType === 'add' ? 'Added' : 'Removed'}
                </motion.p>

                {/* Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="mb-6"
                >
                  <span className="text-2xl font-semibold text-foreground">{amount}</span>
                  <span className="text-base text-muted-foreground ml-1.5">
                    {actionType === 'add' ? validatorToken.symbol : 'LP'}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userToken.symbol}/{validatorToken.symbol} Pool
                  </p>
                </motion.div>

                {/* Details card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-3 text-left"
                >
                  {/* Action */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Action</span>
                    <span className="text-xs font-medium text-foreground capitalize">
                      {actionType} Liquidity
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
