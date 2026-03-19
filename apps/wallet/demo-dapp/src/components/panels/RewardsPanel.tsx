import { type ReactElement, useState } from 'react';
import { Gift } from 'lucide-react';
import type { Address } from 'viem';
import { Actions } from 'viem/tempo';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';

export function RewardsPanel(): ReactElement {
  const { walletClient } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  const handleClaim = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await Actions.reward.claim(walletClient!, { token: token as Address });
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.reward.claim</span>
          <span className="text-[11px] text-[#9B9590]">token</span>
        </div>
        <div className="space-y-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token address to claim rewards for"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors"
          />
          <button
            onClick={handleClaim}
            disabled={loading || !token}
            className="w-full px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Claiming...' : 'Claim Rewards'}
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}
