import { type ReactElement, useState } from 'react';
import { Droplets } from 'lucide-react';
import type { Address } from 'viem';
import { Actions } from 'viem/tempo';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';
import { parseAmount } from '@/lib/utils';

export function AmmPanel(): ReactElement {
  const { walletClient, address } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Add Liquidity
  const [addUserToken, setAddUserToken] = useState('');
  const [addValidatorToken, setAddValidatorToken] = useState('');
  const [addAmount, setAddAmount] = useState('1');

  // Remove Liquidity
  const [rmUserToken, setRmUserToken] = useState('');
  const [rmValidatorToken, setRmValidatorToken] = useState('');
  const [rmLiquidity, setRmLiquidity] = useState('1');

  // AMM Swap
  const [swapUserToken, setSwapUserToken] = useState('');
  const [swapValidatorToken, setSwapValidatorToken] = useState('');
  const [swapAmountOut, setSwapAmountOut] = useState('1');

  const exec = async (label: string, fn: () => Promise<unknown>) => {
    setLoading(label);
    setResult(null);
    try {
      const data = await fn();
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors";
  const btnCls = "w-full px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[12px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      {/* Add Liquidity */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.amm.mint</span>
          <span className="text-[11px] text-[#9B9590]">userToken, validatorToken, amount</span>
        </div>
        <div className="space-y-2">
          <input value={addUserToken} onChange={(e) => setAddUserToken(e.target.value)} placeholder="User token address" className={inputCls} />
          <input value={addValidatorToken} onChange={(e) => setAddValidatorToken(e.target.value)} placeholder="Validator token address" className={inputCls} />
          <input value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="Amount" className={inputCls} />
          <button
            onClick={() => exec('add', () => Actions.amm.mint(walletClient!, {
              userTokenAddress: addUserToken as Address,
              validatorTokenAddress: addValidatorToken as Address,
              validatorTokenAmount: parseAmount(addAmount),
              to: address!,
            }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'add' ? 'Adding...' : 'Add Liquidity'}
          </button>
        </div>
      </div>

      {/* Remove Liquidity */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.amm.burn</span>
          <span className="text-[11px] text-[#9B9590]">userToken, validatorToken, liquidity</span>
        </div>
        <div className="space-y-2">
          <input value={rmUserToken} onChange={(e) => setRmUserToken(e.target.value)} placeholder="User token address" className={inputCls} />
          <input value={rmValidatorToken} onChange={(e) => setRmValidatorToken(e.target.value)} placeholder="Validator token address" className={inputCls} />
          <input value={rmLiquidity} onChange={(e) => setRmLiquidity(e.target.value)} placeholder="LP tokens to burn" className={inputCls} />
          <button
            onClick={() => exec('remove', () => Actions.amm.burn(walletClient!, {
              userToken: rmUserToken as Address,
              validatorToken: rmValidatorToken as Address,
              liquidity: parseAmount(rmLiquidity),
              to: address!,
            }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'remove' ? 'Removing...' : 'Remove Liquidity'}
          </button>
        </div>
      </div>

      {/* AMM Swap */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.amm.rebalanceSwap</span>
          <span className="text-[11px] text-[#9B9590]">userToken, validatorToken, amountOut</span>
        </div>
        <div className="space-y-2">
          <input value={swapUserToken} onChange={(e) => setSwapUserToken(e.target.value)} placeholder="User token address" className={inputCls} />
          <input value={swapValidatorToken} onChange={(e) => setSwapValidatorToken(e.target.value)} placeholder="Validator token address" className={inputCls} />
          <input value={swapAmountOut} onChange={(e) => setSwapAmountOut(e.target.value)} placeholder="Amount Out" className={inputCls} />
          <button
            onClick={() => exec('ammSwap', () => Actions.amm.rebalanceSwap(walletClient!, {
              userToken: swapUserToken as Address,
              validatorToken: swapValidatorToken as Address,
              amountOut: parseAmount(swapAmountOut),
              to: address!,
            }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'ammSwap' ? 'Swapping...' : 'AMM Swap'}
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}
