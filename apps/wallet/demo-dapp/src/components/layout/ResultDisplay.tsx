import { type ReactElement } from 'react';
import { CheckCircle, XCircle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ResultDisplayProps {
  result: { success: boolean; data?: unknown; error?: string } | null;
}

const bigIntReplacer = (_: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString() : v;

export function ResultDisplay({ result }: ResultDisplayProps): ReactElement | null {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = async () => {
    const text = result.success
      ? JSON.stringify(result.data, bigIntReplacer, 2)
      : result.error || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result.success) {
    return (
      <div className="mt-3 rounded-xl border border-[#5B9A6F]/20 bg-[#5B9A6F]/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#5B9A6F]" />
            <span className="text-[12px] font-semibold text-[#5B9A6F]">Success</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-[#5B9A6F]/10 rounded-md transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#5B9A6F]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#5B9A6F]/60" />
            )}
          </button>
        </div>
        <pre className="text-[11px] font-mono text-[#2D3436] overflow-auto max-h-32 whitespace-pre-wrap break-all">
          {JSON.stringify(result.data, bigIntReplacer, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-[12px] font-semibold text-red-600">Error</span>
      </div>
      <p className="text-[12px] text-red-600 break-all">{result.error}</p>
    </div>
  );
}
