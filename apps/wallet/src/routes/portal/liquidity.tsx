import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Minus,
  Check,
  ExternalLink,
  DollarSign,
  Loader2,
  Droplets,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
  const navigate = useNavigate();
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
      const actionText = actionType === 'add' ? 'added' : 'removed';
      toast.success(`Liquidity ${actionText}!`, {
        description: `Successfully ${actionText} liquidity to ${userToken.symbol}/${validatorToken.symbol} pool`,
      });
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to ${actionType} liquidity`, {
        description: errorMessage.slice(0, 100),
      });
      setModalState(null);
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
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate({ to: '/portal/dashboard' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">Liquidity</h1>
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
              <Select
                value={userToken?.address}
                onValueChange={value => {
                  const token = tokens.find(t => t.address === value);
                  if (token) {
                    if (token.address === validatorToken?.address) {
                      setValidatorToken(userToken);
                    }
                    setUserToken(token);
                  }
                }}
              >
                <SelectTrigger className="w-full h-10 bg-white shadow-sm border-gray-200">
                  {userToken && (
                    <div className="flex items-center gap-1.5">
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
                    </div>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {tokens.map(token => (
                    <SelectItem key={token.address} value={token.address}>
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Validator Token */}
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Token B
              </label>
              <Select
                value={validatorToken?.address}
                onValueChange={value => {
                  const token = tokens.find(t => t.address === value);
                  if (token) {
                    if (token.address === userToken?.address) {
                      setUserToken(validatorToken);
                    }
                    setValidatorToken(token);
                  }
                }}
              >
                <SelectTrigger className="w-full h-10 bg-white shadow-sm border-gray-200">
                  {validatorToken && (
                    <div className="flex items-center gap-1.5">
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
                    </div>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {tokens.map(token => (
                    <SelectItem key={token.address} value={token.address}>
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          className="sm:max-w-sm p-0 overflow-hidden"
        >
          {modalState === 'confirm' && userToken && validatorToken && (
            <div className="p-5">
              <DialogTitle className="sr-only">
                Confirm {actionType === 'add' ? 'Add' : 'Remove'} Liquidity
              </DialogTitle>
              <DialogDescription className="sr-only">
                Confirm your liquidity action
              </DialogDescription>

              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  {actionType === 'add' ? (
                    <Plus className="h-6 w-6 text-primary" />
                  ) : (
                    <Minus className="h-6 w-6 text-primary" />
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mb-1">
                  {actionType === 'add' ? 'Add Liquidity' : 'Remove Liquidity'}
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {amount}{' '}
                  <span className="text-muted-foreground font-normal">
                    {actionType === 'add' ? validatorToken.symbol : 'LP'}
                  </span>
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {userToken.symbol}/{validatorToken.symbol} Pool
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2.5 mb-5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Pool</span>
                  <span className="text-foreground">
                    {userToken.symbol}/{validatorToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Action</span>
                  <span className="text-foreground capitalize">{actionType} Liquidity</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-success">
                    &lt;$0.001 <span className="text-muted-foreground">({feeToken?.symbol})</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setModalState(null)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 h-10" onClick={handleSubmit}>
                  Confirm
                </Button>
              </div>
            </div>
          )}

          {modalState === 'pending' && userToken && validatorToken && (
            <div className="p-8 text-center">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing liquidity action</DialogDescription>

              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-[14px] text-muted-foreground">
                {actionType === 'add' ? 'Adding' : 'Removing'} {amount}{' '}
                {actionType === 'add' ? validatorToken.symbol : 'LP'}
              </p>
            </div>
          )}

          {modalState === 'success' && txHash && userToken && validatorToken && (
            <div className="p-5 text-center">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Liquidity action completed</DialogDescription>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-6 w-6 text-success" />
              </motion.div>

              <p className="text-[15px] font-semibold text-foreground mb-0.5">
                Liquidity {actionType === 'add' ? 'Added' : 'Removed'}!
              </p>
              <p className="text-[13px] text-muted-foreground mb-4">
                {amount} {actionType === 'add' ? validatorToken.symbol : 'LP'} in {userToken.symbol}
                /{validatorToken.symbol} pool
              </p>

              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Transaction
                </p>
                <p className="font-mono text-[11px] text-foreground break-all">{txHash}</p>
              </div>

              <div className="flex gap-2">
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
                <Button className="flex-1 h-10" onClick={resetForm}>
                  Continue
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
