/**
 * Main contract interaction UI with tabs for read/write functions.
 */

import type React from 'react';
import { useMemo, useCallback } from 'react';
import type { Abi, AbiFunction, Address, Hash } from 'viem';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FunctionCard } from './FunctionCard';
import { useTempo } from '@/hooks/useTempo';

interface ContractInteractorProps {
  address: Address;
  abi: Abi;
}

export function ContractInteractor({ address, abi }: ContractInteractorProps): React.ReactElement {
  const { isConnected, callContract, writeContract } = useTempo();

  // Categorize functions
  const { readFunctions, writeFunctions } = useMemo(() => {
    const functions = abi.filter((item): item is AbiFunction => item.type === 'function');

    const read = functions.filter(
      fn => fn.stateMutability === 'view' || fn.stateMutability === 'pure'
    );

    const write = functions.filter(
      fn => fn.stateMutability !== 'view' && fn.stateMutability !== 'pure'
    );

    return { readFunctions: read, writeFunctions: write };
  }, [abi]);

  const handleCall = useCallback(
    async (fn: AbiFunction, args: unknown[]) => {
      return callContract({
        address,
        abi,
        functionName: fn.name,
        args,
      });
    },
    [address, abi, callContract]
  );

  const handleWrite = useCallback(
    async (fn: AbiFunction, args: unknown[]): Promise<Hash> => {
      return writeContract({
        address,
        abi,
        functionName: fn.name,
        args,
      });
    },
    [address, abi, writeContract]
  );

  return (
    <Tabs defaultValue="read" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="read">Read ({readFunctions.length})</TabsTrigger>
        <TabsTrigger value="write">Write ({writeFunctions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="read" className="mt-4">
        {readFunctions.length === 0 ? (
          <EmptyState message="No read functions" />
        ) : (
          <div className="space-y-4">
            {readFunctions.map(fn => (
              <FunctionCard
                key={fn.name}
                fn={fn}
                type="read"
                onCall={args => handleCall(fn, args)}
                onWrite={args => handleWrite(fn, args)}
                isConnected={isConnected}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="write" className="mt-4">
        {writeFunctions.length === 0 ? (
          <EmptyState message="No write functions" />
        ) : (
          <div className="space-y-4">
            {writeFunctions.map(fn => (
              <FunctionCard
                key={fn.name}
                fn={fn}
                type="write"
                onCall={args => handleCall(fn, args)}
                onWrite={args => handleWrite(fn, args)}
                isConnected={isConnected}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}
