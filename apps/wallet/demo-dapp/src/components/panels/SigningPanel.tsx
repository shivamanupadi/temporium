import { type ReactElement, useState } from 'react';
import { PenTool } from 'lucide-react';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';

export function SigningPanel(): ReactElement {
  const { gateway } = useGateway();
  const [message, setMessage] = useState('Hello from Gateway Test dApp!');
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await gateway.signMessage(message);
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
          Message to sign
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] text-[13px] text-[#2D3436] resize-none focus:border-[#E07A5F] transition-colors"
          placeholder="Enter a message to sign..."
        />
        <p className="text-[11px] text-[#9B9590] mt-1">{message.length} / 10240 chars</p>
      </div>

      <button
        onClick={handleSign}
        disabled={loading || !message}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
      >
        <PenTool className="w-4 h-4" />
        {loading ? 'Signing...' : 'Sign Message'}
      </button>

      <ResultDisplay result={result} />
    </div>
  );
}
