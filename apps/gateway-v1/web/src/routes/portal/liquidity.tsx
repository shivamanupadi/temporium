import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Droplets,
  Plus,
  Minus,
  Loader2,
  CheckCircle,
  ExternalLink,
  Info,
} from 'lucide-react';
import { type Address } from 'viem';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTempo, useTokenBalance } from '@/hooks/useTempo';
import { DEFAULT_FEE_TOKEN_ADDRESS, TIMING } from '@/lib/constants';
import { formatAmount, parseAmount, isValidAddress } from '@/lib/utils';
import {
  getPoolInfo,
  getLiquidityBalance,
  getExplorerTxUrl,
  type PoolInfo,
} from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/liquidity')({
  component: LiquidityPage,
});

type Tab = 'add' | 'remove';

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

function LiquidityPage(): ReactElement {
  const { address, addLiquidity, removeLiquidity } = useTempo();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('add');

  // Form state: Add Liquidity
  const [addUserToken, setAddUserToken] = useState('');
  const [addValidatorToken, setAddValidatorToken] = useState('');
  const [addAmount, setAddAmount] = useState('');

  // Form state: Remove Liquidity
  const [removeUserToken, setRemoveUserToken] = useState('');
  const [removeValidatorToken, setRemoveValidatorToken] = useState('');
  const [removeAmount, setRemoveAmount] = useState('');

  // Pool info
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  // LP balance
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [isLoadingLpBalance, setIsLoadingLpBalance] = useState(false);

  // Transaction state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Token balances for Add tab
  const addUserTokenAddress = isValidAddress(addUserToken)
    ? (addUserToken as Address)
    : undefined;
  const addValidatorTokenAddress = isValidAddress(addValidatorToken)
    ? (addValidatorToken as Address)
    : undefined;
  const { data: userTokenBalanceData, isLoading: isUserBalanceLoading } =
    useTokenBalance(addValidatorTokenAddress, address);

  // Fetch pool info when both token addresses are valid
  const fetchPoolInfo = useCallback(async (userToken: string, validatorToken: string) => {
    if (!isValidAddress(userToken) || !isValidAddress(validatorToken)) {
      setPoolInfo(null);
      return;
    }
    setIsLoadingPool(true);
    try {
      const info = await getPoolInfo(
        userToken as Address,
        validatorToken as Address,
      );
      setPoolInfo(info);
    } catch {
      setPoolInfo(null);
    } finally {
      setIsLoadingPool(false);
    }
  }, []);

  // Fetch LP balance
  const fetchLpBalance = useCallback(
    async (userToken: string, validatorToken: string) => {
      if (
        !address ||
        !isValidAddress(userToken) ||
        !isValidAddress(validatorToken)
      ) {
        setLpBalance(0n);
        return;
      }
      setIsLoadingLpBalance(true);
      try {
        const balance = await getLiquidityBalance(
          userToken as Address,
          validatorToken as Address,
          address,
        );
        setLpBalance(balance);
      } catch {
        setLpBalance(0n);
      } finally {
        setIsLoadingLpBalance(false);
      }
    },
    [address],
  );

  // Pool info effect for Add tab
  useEffect(() => {
    if (activeTab === 'add') {
      fetchPoolInfo(addUserToken, addValidatorToken);
    }
  }, [activeTab, addUserToken, addValidatorToken, fetchPoolInfo]);

  // Pool info + LP balance effect for Remove tab
  useEffect(() => {
    if (activeTab === 'remove') {
      fetchPoolInfo(removeUserToken, removeValidatorToken);
      fetchLpBalance(removeUserToken, removeValidatorToken);
    }
  }, [activeTab, removeUserToken, removeValidatorToken, fetchPoolInfo, fetchLpBalance]);

  // Auto-refresh pool info
  useEffect(() => {
    const userToken = activeTab === 'add' ? addUserToken : removeUserToken;
    const validatorToken = activeTab === 'add' ? addValidatorToken : removeValidatorToken;

    if (!isValidAddress(userToken) || !isValidAddress(validatorToken)) return;

    const interval = setInterval(() => {
      fetchPoolInfo(userToken, validatorToken);
      if (activeTab === 'remove') {
        fetchLpBalance(userToken, validatorToken);
      }
    }, TIMING.POOL_REFRESH_MS);

    return () => clearInterval(interval);
  }, [
    activeTab,
    addUserToken,
    addValidatorToken,
    removeUserToken,
    removeValidatorToken,
    fetchPoolInfo,
    fetchLpBalance,
  ]);

  const handleAddLiquidity = async (): Promise<void> => {
    if (!addUserTokenAddress || !addValidatorTokenAddress || !addAmount) return;

    const parsedAmount = parseAmount(addAmount);
    if (parsedAmount <= 0n) {
      toast.error('Enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setTxHash(null);
    try {
      const hash = await addLiquidity({
        userToken: addUserTokenAddress,
        validatorToken: addValidatorTokenAddress,
        validatorTokenAmount: parsedAmount,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      });
      setTxHash(hash);
      setAddAmount('');
      toast.success('Liquidity added successfully');
      // Refresh pool info
      fetchPoolInfo(addUserToken, addValidatorToken);
    } catch (err) {
      toast.error('Failed to add liquidity', {
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async (): Promise<void> => {
    const removeUserAddr = isValidAddress(removeUserToken)
      ? (removeUserToken as Address)
      : undefined;
    const removeValidatorAddr = isValidAddress(removeValidatorToken)
      ? (removeValidatorToken as Address)
      : undefined;

    if (!removeUserAddr || !removeValidatorAddr || !removeAmount) return;

    const parsedAmount = parseAmount(removeAmount);
    if (parsedAmount <= 0n) {
      toast.error('Enter a valid amount');
      return;
    }
    if (parsedAmount > lpBalance) {
      toast.error('Amount exceeds your LP balance');
      return;
    }

    setIsSubmitting(true);
    setTxHash(null);
    try {
      const hash = await removeLiquidity({
        userToken: removeUserAddr,
        validatorToken: removeValidatorAddr,
        liquidity: parsedAmount,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      });
      setTxHash(hash);
      setRemoveAmount('');
      toast.success('Liquidity removed successfully');
      // Refresh pool info and LP balance
      fetchPoolInfo(removeUserToken, removeValidatorToken);
      fetchLpBalance(removeUserToken, removeValidatorToken);
    } catch (err) {
      toast.error('Failed to remove liquidity', {
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxRemove = (): void => {
    if (lpBalance > 0n) {
      setRemoveAmount(formatAmount(lpBalance, 6, 6));
    }
  };

  const canAdd =
    addUserTokenAddress &&
    addValidatorTokenAddress &&
    addAmount &&
    parseAmount(addAmount) > 0n &&
    !isSubmitting;

  const canRemove =
    isValidAddress(removeUserToken) &&
    isValidAddress(removeValidatorToken) &&
    removeAmount &&
    parseAmount(removeAmount) > 0n &&
    parseAmount(removeAmount) <= lpBalance &&
    !isSubmitting;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Liquidity</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Provide liquidity to pools and earn fees from trades.
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
      >
        {/* Tab Switcher */}
        <div className="flex border-b border-[#EDE9E3]">
          <button
            onClick={() => { setActiveTab('add'); setTxHash(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[14px] font-semibold transition-all ${
              activeTab === 'add'
                ? 'text-[#5B9A6F] border-b-2 border-[#5B9A6F] bg-[#5B9A6F]/4'
                : 'text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Liquidity
          </button>
          <button
            onClick={() => { setActiveTab('remove'); setTxHash(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[14px] font-semibold transition-all ${
              activeTab === 'remove'
                ? 'text-[#E07A5F] border-b-2 border-[#E07A5F] bg-[#E07A5F]/4'
                : 'text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED]'
            }`}
          >
            <Minus className="w-4 h-4" />
            Remove Liquidity
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 md:p-6">
          {activeTab === 'add' ? (
            <AddLiquidityForm
              userToken={addUserToken}
              validatorToken={addValidatorToken}
              amount={addAmount}
              onUserTokenChange={setAddUserToken}
              onValidatorTokenChange={setAddValidatorToken}
              onAmountChange={setAddAmount}
              validatorBalance={userTokenBalanceData.value}
              isBalanceLoading={isUserBalanceLoading}
              isSubmitting={isSubmitting}
              canSubmit={!!canAdd}
              onSubmit={handleAddLiquidity}
            />
          ) : (
            <RemoveLiquidityForm
              userToken={removeUserToken}
              validatorToken={removeValidatorToken}
              amount={removeAmount}
              onUserTokenChange={setRemoveUserToken}
              onValidatorTokenChange={setRemoveValidatorToken}
              onAmountChange={setRemoveAmount}
              lpBalance={lpBalance}
              isLoadingLpBalance={isLoadingLpBalance}
              isSubmitting={isSubmitting}
              canSubmit={!!canRemove}
              onSubmit={handleRemoveLiquidity}
              onMax={handleMaxRemove}
            />
          )}

          {/* Transaction Success */}
          {txHash && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-[#5B9A6F]/8 border border-[#5B9A6F]/20"
            >
              <CheckCircle className="w-5 h-5 text-[#5B9A6F] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#2D3436]">
                  Transaction confirmed
                </p>
                <p className="text-[12px] text-[#6B6560] font-mono truncate mt-0.5">
                  {txHash}
                </p>
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
        </div>
      </motion.div>

      {/* Pool Info Card */}
      <PoolInfoCard poolInfo={poolInfo} isLoading={isLoadingPool} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Add Liquidity Form
// ---------------------------------------------------------------------------

interface AddLiquidityFormProps {
  userToken: string;
  validatorToken: string;
  amount: string;
  onUserTokenChange: (value: string) => void;
  onValidatorTokenChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  validatorBalance: bigint;
  isBalanceLoading: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

function AddLiquidityForm({
  userToken,
  validatorToken,
  amount,
  onUserTokenChange,
  onValidatorTokenChange,
  onAmountChange,
  validatorBalance,
  isBalanceLoading,
  isSubmitting,
  canSubmit,
  onSubmit,
}: AddLiquidityFormProps): ReactElement {
  return (
    <div className="space-y-4">
      {/* User Token Address */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          User Token Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={userToken}
          onChange={(e) => onUserTokenChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-[#5B9A6F]/40 focus:outline-none transition-colors"
        />
        {userToken && !isValidAddress(userToken) && (
          <p className="text-[11px] text-[#E07A5F] mt-1.5">Invalid address format</p>
        )}
      </div>

      {/* Validator Token Address */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Validator Token Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={validatorToken}
          onChange={(e) => onValidatorTokenChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-[#5B9A6F]/40 focus:outline-none transition-colors"
        />
        {validatorToken && !isValidAddress(validatorToken) && (
          <p className="text-[11px] text-[#E07A5F] mt-1.5">Invalid address format</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
            Validator Token Amount
          </label>
          {isValidAddress(validatorToken) && (
            <span className="text-[12px] text-[#9B9590]">
              Balance:{' '}
              {isBalanceLoading ? (
                <Loader2 className="w-3 h-3 animate-spin inline" />
              ) : (
                <span className="font-medium text-[#2D3436]">
                  {formatAmount(validatorBalance)}
                </span>
              )}
            </span>
          )}
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[0-9]*\.?[0-9]*$/.test(val)) {
              onAmountChange(val);
            }
          }}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[18px] font-semibold text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-[#5B9A6F]/40 focus:outline-none transition-colors"
        />
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
        <Info className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#6B6560] leading-relaxed">
          The matching amount of user tokens will be determined by the current pool ratio.
          If this is a new pool, you set the initial ratio.
        </p>
      </div>

      {/* Submit */}
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Adding Liquidity...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Add Liquidity
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Remove Liquidity Form
// ---------------------------------------------------------------------------

interface RemoveLiquidityFormProps {
  userToken: string;
  validatorToken: string;
  amount: string;
  onUserTokenChange: (value: string) => void;
  onValidatorTokenChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  lpBalance: bigint;
  isLoadingLpBalance: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onMax: () => void;
}

function RemoveLiquidityForm({
  userToken,
  validatorToken,
  amount,
  onUserTokenChange,
  onValidatorTokenChange,
  onAmountChange,
  lpBalance,
  isLoadingLpBalance,
  isSubmitting,
  canSubmit,
  onSubmit,
  onMax,
}: RemoveLiquidityFormProps): ReactElement {
  return (
    <div className="space-y-4">
      {/* User Token Address */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          User Token Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={userToken}
          onChange={(e) => onUserTokenChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-[#E07A5F]/40 focus:outline-none transition-colors"
        />
        {userToken && !isValidAddress(userToken) && (
          <p className="text-[11px] text-[#E07A5F] mt-1.5">Invalid address format</p>
        )}
      </div>

      {/* Validator Token Address */}
      <div>
        <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
          Validator Token Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={validatorToken}
          onChange={(e) => onValidatorTokenChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-[#E07A5F]/40 focus:outline-none transition-colors"
        />
        {validatorToken && !isValidAddress(validatorToken) && (
          <p className="text-[11px] text-[#E07A5F] mt-1.5">Invalid address format</p>
        )}
      </div>

      {/* LP Balance Display */}
      <div className="p-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[#9B72CF]" />
            <span className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
              Your LP Balance
            </span>
          </div>
          {isLoadingLpBalance ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#B5B0AA]" />
          ) : (
            <span className="text-[16px] font-bold text-[#2D3436]">
              {formatAmount(lpBalance)}
            </span>
          )}
        </div>
      </div>

      {/* Amount to Remove */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
            Amount to Remove
          </label>
          {lpBalance > 0n && (
            <button
              onClick={onMax}
              className="text-[12px] font-semibold text-[#E07A5F] hover:text-[#D06A4F] transition-colors"
            >
              Max
            </button>
          )}
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[0-9]*\.?[0-9]*$/.test(val)) {
              onAmountChange(val);
            }
          }}
          className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[18px] font-semibold text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-[#E07A5F]/40 focus:outline-none transition-colors"
        />
        {amount && parseAmount(amount) > lpBalance && lpBalance > 0n && (
          <p className="text-[11px] text-[#E07A5F] mt-1.5">
            Amount exceeds your LP balance
          </p>
        )}
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
        <Info className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#6B6560] leading-relaxed">
          Removing liquidity returns both tokens proportional to your share of the pool.
        </p>
      </div>

      {/* Submit */}
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Removing Liquidity...
          </>
        ) : (
          <>
            <Minus className="w-4 h-4 mr-2" />
            Remove Liquidity
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool Info Card
// ---------------------------------------------------------------------------

interface PoolInfoCardProps {
  poolInfo: PoolInfo | null;
  isLoading: boolean;
}

function PoolInfoCard({ poolInfo, isLoading }: PoolInfoCardProps): ReactElement {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-2xl border border-[#EDE9E3] bg-white p-5 md:p-6"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center">
          <Droplets className="w-4.5 h-4.5 text-[#9B72CF]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#2D3436]">Pool Information</h2>
          <p className="text-[12px] text-[#9B9590]">Current reserves and total supply</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#B5B0AA]" />
          <span className="text-[13px] text-[#9B9590] ml-2">Loading pool data...</span>
        </div>
      ) : poolInfo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
            <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
              User Token Reserve
            </p>
            <p className="text-[18px] font-bold text-[#2D3436] tracking-tight">
              {formatAmount(poolInfo.reserveUserToken)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
            <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
              Validator Token Reserve
            </p>
            <p className="text-[18px] font-bold text-[#2D3436] tracking-tight">
              {formatAmount(poolInfo.reserveValidatorToken)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
            <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
              Total LP Supply
            </p>
            <p className="text-[18px] font-bold text-[#2D3436] tracking-tight">
              {formatAmount(poolInfo.totalSupply)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mb-3">
            <Droplets className="w-6 h-6 text-[#B5B0AA]" />
          </div>
          <p className="text-[14px] font-medium text-[#6B6560]">No pool data available</p>
          <p className="text-[12px] text-[#9B9590] mt-1 max-w-xs">
            Enter valid user token and validator token addresses above to view pool information.
          </p>
        </div>
      )}
    </motion.div>
  );
}
