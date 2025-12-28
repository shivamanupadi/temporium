/**
 * Card for a single contract function with inputs and outputs.
 */

import type React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Play, Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { AbiFunction, Hash } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FunctionInput, parseInputValue } from './FunctionInput';
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="font-mono">{fn.name}</span>
          <Badge variant={isRead ? 'secondary' : 'default'} className="text-xs">
            {isRead ? 'view' : 'write'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Inputs */}
        {inputs.length > 0 && (
          <div className="space-y-2">
            {inputs.map((input, index) => (
              <FunctionInput
                key={input.name || index}
                input={input}
                index={index}
                value={inputValues[input.name || `arg${index}`] || ''}
                onChange={value => handleInputChange(input.name || `arg${index}`, value)}
              />
            ))}
          </div>
        )}

        {/* Execute Button */}
        <Button
          size="sm"
          variant={isRead ? 'outline' : 'default'}
          className="w-full"
          disabled={isLoading || (!isRead && !isConnected)}
          onClick={handleExecute}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              {isRead ? 'Calling...' : 'Sending...'}
            </>
          ) : isRead ? (
            <>
              <Play className="mr-2 h-3 w-3" />
              Call
            </>
          ) : (
            <>
              <Send className="mr-2 h-3 w-3" />
              {isConnected ? 'Send Transaction' : 'Connect Wallet'}
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Read Result */}
        {result !== null && isRead && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Result:</span>
            <FunctionOutput value={result} />
          </div>
        )}

        {/* Write Result (tx hash) */}
        {txHash && !isRead && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-500">
            <CheckCircle className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{txHash}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
