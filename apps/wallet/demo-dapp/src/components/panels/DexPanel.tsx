import { type ReactElement, useState } from 'react';
import { ArrowRightLeft, ShoppingCart, ListOrdered, Ban, GitBranch, ArrowUpFromLine } from 'lucide-react';
import type { Address } from 'viem';
import { Actions } from 'viem/tempo';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';
import { parseAmount } from '@/lib/utils';

export function DexPanel(): ReactElement {
  const { walletClient } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Swap
  const [swapTokenIn, setSwapTokenIn] = useState('');
  const [swapTokenOut, setSwapTokenOut] = useState('');
  const [swapAmountIn, setSwapAmountIn] = useState('1');
  const [swapMinOut, setSwapMinOut] = useState('0.9');

  // Buy
  const [buyTokenIn, setBuyTokenIn] = useState('');
  const [buyTokenOut, setBuyTokenOut] = useState('');
  const [buyAmountOut, setBuyAmountOut] = useState('1');
  const [buyMaxIn, setBuyMaxIn] = useState('1.1');

  // Place Order
  const [orderToken, setOrderToken] = useState('');
  const [orderAmount, setOrderAmount] = useState('1');
  const [orderTick, setOrderTick] = useState('100');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');

  // Cancel Order
  const [cancelOrderId, setCancelOrderId] = useState('');

  // Create Pair
  const [pairBase, setPairBase] = useState('');

  // Withdraw
  const [withdrawToken, setWithdrawToken] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('1');

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
      {/* Swap Tokens */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.sell</span>
          <span className="text-[11px] text-[#9B9590]">tokenIn, tokenOut, amountIn, minAmountOut</span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={swapTokenIn} onChange={(e) => setSwapTokenIn(e.target.value)} placeholder="Token In address" className={inputCls} />
            <input value={swapTokenOut} onChange={(e) => setSwapTokenOut(e.target.value)} placeholder="Token Out address" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={swapAmountIn} onChange={(e) => setSwapAmountIn(e.target.value)} placeholder="Amount In" className={inputCls} />
            <input value={swapMinOut} onChange={(e) => setSwapMinOut(e.target.value)} placeholder="Min Amount Out" className={inputCls} />
          </div>
          <button
            onClick={() => exec('swap', () => Actions.dex.sell(walletClient!, { tokenIn: swapTokenIn as Address, tokenOut: swapTokenOut as Address, amountIn: parseAmount(swapAmountIn), minAmountOut: parseAmount(swapMinOut) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'swap' ? 'Swapping...' : 'Swap Tokens'}
          </button>
        </div>
      </div>

      {/* Buy Tokens */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.buy</span>
          <span className="text-[11px] text-[#9B9590]">tokenIn, tokenOut, amountOut, maxAmountIn</span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={buyTokenIn} onChange={(e) => setBuyTokenIn(e.target.value)} placeholder="Token In address" className={inputCls} />
            <input value={buyTokenOut} onChange={(e) => setBuyTokenOut(e.target.value)} placeholder="Token Out address" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={buyAmountOut} onChange={(e) => setBuyAmountOut(e.target.value)} placeholder="Amount Out" className={inputCls} />
            <input value={buyMaxIn} onChange={(e) => setBuyMaxIn(e.target.value)} placeholder="Max Amount In" className={inputCls} />
          </div>
          <button
            onClick={() => exec('buy', () => Actions.dex.buy(walletClient!, { tokenIn: buyTokenIn as Address, tokenOut: buyTokenOut as Address, amountOut: parseAmount(buyAmountOut), maxAmountIn: parseAmount(buyMaxIn) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'buy' ? 'Buying...' : 'Buy Tokens'}
          </button>
        </div>
      </div>

      {/* Place Order */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <ListOrdered className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.place</span>
          <span className="text-[11px] text-[#9B9590]">token, amount, tick, type</span>
        </div>
        <div className="space-y-2">
          <input value={orderToken} onChange={(e) => setOrderToken(e.target.value)} placeholder="Token address" className={inputCls} />
          <div className="grid grid-cols-3 gap-2">
            <input value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="Amount" className={inputCls} />
            <input value={orderTick} onChange={(e) => setOrderTick(e.target.value)} placeholder="Tick" className={inputCls} />
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'buy' | 'sell')}
              className={inputCls}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <button
            onClick={() => exec('place', () => Actions.dex.place(walletClient!, { token: orderToken as Address, amount: parseAmount(orderAmount), tick: Number(orderTick), type: orderType }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'place' ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      </div>

      {/* Cancel Order */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Ban className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.cancel</span>
          <span className="text-[11px] text-[#9B9590]">orderId</span>
        </div>
        <div className="space-y-2">
          <input value={cancelOrderId} onChange={(e) => setCancelOrderId(e.target.value)} placeholder="Order ID" className={inputCls} />
          <button
            onClick={() => exec('cancel', () => Actions.dex.cancel(walletClient!, { orderId: BigInt(cancelOrderId) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'cancel' ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>

      {/* Create Pair */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.createPair</span>
          <span className="text-[11px] text-[#9B9590]">base</span>
        </div>
        <div className="space-y-2">
          <input value={pairBase} onChange={(e) => setPairBase(e.target.value)} placeholder="Base token address" className={inputCls} />
          <button
            onClick={() => exec('pair', () => Actions.dex.createPair(walletClient!, { base: pairBase as Address }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'pair' ? 'Creating...' : 'Create Pair'}
          </button>
        </div>
      </div>

      {/* DEX Withdraw */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.dex.withdraw</span>
          <span className="text-[11px] text-[#9B9590]">token, amount</span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={withdrawToken} onChange={(e) => setWithdrawToken(e.target.value)} placeholder="Token address" className={inputCls} />
            <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount" className={inputCls} />
          </div>
          <button
            onClick={() => exec('withdraw', () => Actions.dex.withdraw(walletClient!, { token: withdrawToken as Address, amount: parseAmount(withdrawAmount) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'withdraw' ? 'Withdrawing...' : 'DEX Withdraw'}
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}
