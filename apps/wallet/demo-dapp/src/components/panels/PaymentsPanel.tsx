import { type ReactElement, useState } from 'react';
import { Send, Clock } from 'lucide-react';
import type { Address } from 'viem';
import { Actions } from 'viem/tempo';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';
import { DEFAULT_FEE_TOKEN, KNOWN_TOKENS } from '@/lib/constants';
import { parseAmount } from '@/lib/utils';

export function PaymentsPanel(): ReactElement {
  const { walletClient } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Send Payment fields
  const [payTo, setPayTo] = useState('');
  const [payAmount, setPayAmount] = useState('1');
  const [payToken, setPayToken] = useState(KNOWN_TOKENS.USD.address);
  const [payFeeToken, setPayFeeToken] = useState(DEFAULT_FEE_TOKEN);
  const [payMemo, setPayMemo] = useState('');

  // Scheduled Payment fields
  const [schedTo, setSchedTo] = useState('');
  const [schedAmount, setSchedAmount] = useState('1');
  const [schedToken, setSchedToken] = useState(KNOWN_TOKENS.USD.address);
  const [schedDate, setSchedDate] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Send Payment */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.transfer</span>
          <span className="text-[11px] text-[#9B9590]">token, to, amount, feeToken?, memo?</span>
        </div>
        <div className="space-y-2">
          <input
            value={payTo}
            onChange={(e) => setPayTo(e.target.value)}
            placeholder="Recipient address (0x...)"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
            <input
              value={payToken}
              onChange={(e) => setPayToken(e.target.value as Address)}
              placeholder="Token address"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] font-mono text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={payFeeToken}
              onChange={(e) => setPayFeeToken(e.target.value as Address)}
              placeholder="Fee token (optional)"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] font-mono text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
            <input
              value={payMemo}
              onChange={(e) => setPayMemo(e.target.value)}
              placeholder="Memo (optional)"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
          </div>
          <button
            onClick={() =>
              exec('sendPayment', () =>
                Actions.token.transfer(walletClient!, {
                  token: payToken,
                  to: payTo as Address,
                  amount: parseAmount(payAmount),
                  feeToken: payFeeToken || undefined,
                  memo: payMemo ? (`0x${Buffer.from(payMemo).toString('hex')}` as `0x${string}`) : undefined,
                })
              )
            }
            disabled={loading !== null}
            className="w-full px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'sendPayment' ? 'Sending...' : 'Send Payment'}
          </button>
        </div>
      </div>

      {/* Scheduled Payment */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.transfer</span>
          <span className="text-[11px] text-[#9B9590]">+ validAfter (scheduled)</span>
        </div>
        <div className="space-y-2">
          <input
            value={schedTo}
            onChange={(e) => setSchedTo(e.target.value)}
            placeholder="Recipient address (0x...)"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={schedAmount}
              onChange={(e) => setSchedAmount(e.target.value)}
              placeholder="Amount"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
            <input
              value={schedToken}
              onChange={(e) => setSchedToken(e.target.value as Address)}
              placeholder="Token address"
              className="px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] font-mono text-[#2D3436] focus:border-[#E07A5F] transition-colors"
            />
          </div>
          <input
            type="datetime-local"
            value={schedDate}
            onChange={(e) => setSchedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
          />
          <button
            onClick={() =>
              exec('sendScheduledPayment', () =>
                Actions.token.transfer(walletClient!, {
                  token: schedToken,
                  to: schedTo as Address,
                  amount: parseAmount(schedAmount),
                  validAfter: Math.floor(new Date(schedDate).getTime() / 1000),
                })
              )
            }
            disabled={loading !== null || !schedDate}
            className="w-full px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'sendScheduledPayment' ? 'Scheduling...' : 'Schedule Payment'}
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}
