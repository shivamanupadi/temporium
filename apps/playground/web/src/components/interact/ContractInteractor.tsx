/**
 * Contract interaction UI - Clean, modern design matching DeployPanel.
 */

import type React from 'react';
import { useMemo, useCallback, useState } from 'react';
import type { Abi, AbiFunction, Address, Hash } from 'viem';
import { Eye, Pencil } from 'lucide-react';
import { FunctionCard } from './FunctionCard';
import { useTempo } from '@/hooks/useTempo';

interface ContractInteractorProps {
  address: Address;
  abi: Abi;
}

export function ContractInteractor({ address, abi }: ContractInteractorProps): React.ReactElement {
  const { isConnected, callContract, writeContract } = useTempo();
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');

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

  const currentFunctions = activeTab === 'read' ? readFunctions : writeFunctions;

  return (
    <div className="space-y-3">
      {/* Tab Buttons */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setActiveTab('read')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'read'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Read ({readFunctions.length})
        </button>
        <button
          onClick={() => setActiveTab('write')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'write'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Write ({writeFunctions.length})
        </button>
      </div>

      {/* Functions List */}
      {currentFunctions.length === 0 ? (
        <EmptyState type={activeTab} />
      ) : (
        <div className="space-y-2">
          {currentFunctions.map(fn => (
            <FunctionCard
              key={fn.name}
              fn={fn}
              type={activeTab}
              onCall={args => handleCall(fn, args)}
              onWrite={args => handleWrite(fn, args)}
              isConnected={isConnected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ type }: { type: 'read' | 'write' }): React.ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-col items-center text-center">
        {type === 'read' ? (
          <Eye className="h-5 w-5 text-slate-300 mb-2" />
        ) : (
          <Pencil className="h-5 w-5 text-slate-300 mb-2" />
        )}
        <p className="text-[12px] text-slate-500">No {type} functions</p>
      </div>
    </div>
  );
}
