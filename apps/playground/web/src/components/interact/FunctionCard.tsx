/**
 * Function card - Clean, modern design matching DeployPanel.
 */

import type React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Play, Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { AbiFunction, Hash } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseInputValue } from './FunctionInput';
import { FunctionOutput } from './FunctionOutput';

type FunctionType = 'read' | 'write';

interface FunctionCardProps {
  fn: AbiFunction;
  type: FunctionType;
  onCall: (args: unknown[]) => Promise<unknown>;
  onWrite: (args: unknown[]) => Promise<Hash>;
  isConnected: boolean;
}

export function FunctionCard({
  fn,
  type,
  onCall,
  onWrite,
  isConnected,
}: FunctionCardProps): React.ReactElement {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useMemo(() => fn.inputs || [], [fn.inputs]);
  const isRead = type === 'read';

  const handleInputChange = useCallback((name: string, value: string) => {
    setInputValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const parseArgs = useCallback((): unknown[] => {
    return inputs.map((input, index) => {
      const key = input.name || `arg${index}`;
      const value = inputValues[key] || '';
      return parseInputValue(value, input.type);
    });
  }, [inputs, inputValues]);

  const handleExecute = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setTxHash(null);

    try {
      const args = parseArgs();

      if (isRead) {
        const callResult = await onCall(args);
        setResult(callResult);
      } else {
        const hash = await onWrite(args);
        setTxHash(hash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Function Header */}
      <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <code className="text-[12px] font-semibold text-slate-800">{fn.name}</code>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isRead ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isRead ? 'view' : 'write'}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Inputs */}
        {inputs.length > 0 && (
          <div className="space-y-2">
            {inputs.map((input, index) => {
              const name = input.name || `arg${index}`;
              return (
                <div key={name} className="space-y-1">
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="font-mono text-slate-400">({input.type})</span>
                  </label>
                  <Input
                    placeholder={getPlaceholder(input.type)}
                    value={inputValues[name] || ''}
                    onChange={e => handleInputChange(name, e.target.value)}
                    className="h-8 text-[12px] bg-slate-50/50"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Execute Button */}
        <Button
          size="sm"
          variant={isRead ? 'outline' : 'default'}
          className="w-full h-8 text-[12px] font-medium"
          disabled={isLoading || (!isRead && !isConnected)}
          onClick={handleExecute}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              {isRead ? 'Calling...' : 'Sending...'}
            </>
          ) : isRead ? (
            <>
              <Play className="mr-1.5 h-3 w-3" />
              Call
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3 w-3" />
              {isConnected ? 'Send' : 'Connect Wallet'}
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-2">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
            <p className="text-[11px] text-red-600 break-all">{error}</p>
          </div>
        )}

        {/* Read Result */}
        {result !== null && isRead && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Result</span>
            <div className="rounded-lg bg-green-50 border border-green-100 p-2">
              <FunctionOutput value={result} />
            </div>
          </div>
        )}

        {/* Write Result (tx hash) */}
        {txHash && !isRead && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 p-2">
            <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
            <span className="truncate font-mono text-[11px] text-green-700">{txHash}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...';
  if (type.startsWith('uint') || type.startsWith('int')) return '0';
  if (type === 'bool') return 'true or false';
  if (type === 'string') return 'Enter text...';
  if (type.startsWith('bytes')) return '0x...';
  if (type.endsWith('[]')) return 'Comma-separated';
  return 'Enter value...';
}
