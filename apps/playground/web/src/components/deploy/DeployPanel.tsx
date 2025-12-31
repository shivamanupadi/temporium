/**
 * Main deploy panel UI - Clean, minimal design.
 */

import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Rocket, Loader2, AlertCircle, CheckCircle2, Code2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContractSelector } from './ContractSelector';
import { ConstructorArgsForm } from './ConstructorArgsForm';
import type { CompiledContract } from '@/lib/compiler';

interface DeployPanelProps {
  contracts: CompiledContract[];
  isConnected: boolean;
  onDeploy: (contract: CompiledContract, args: unknown[]) => Promise<void>;
  isDeploying: boolean;
  error: Error | null;
}

export function DeployPanel({
  contracts,
  isConnected,
  onDeploy,
  isDeploying,
  error,
}: DeployPanelProps): React.ReactElement {
  const [selectedContract, setSelectedContract] = useState<CompiledContract | null>(null);
  const [constructorArgs, setConstructorArgs] = useState<unknown[]>([]);

  // Auto-select if there's only one contract, or reset if contracts change
  useEffect(() => {
    setSelectedContract(prev => {
      if (contracts.length === 0) {
        return prev === null ? prev : null;
      } else if (contracts.length === 1) {
        if (prev?.name === contracts[0].name) return prev;
        return contracts[0];
      } else {
        if (!prev) return null;
        const stillExists = contracts.find(c => c.name === prev.name);
        return stillExists ?? null;
      }
    });
  }, [contracts]);

  const handleArgsChange = useCallback((args: unknown[]) => {
    setConstructorArgs(args);
  }, []);

  const handleDeploy = async (): Promise<void> => {
    if (!selectedContract) return;
    await onDeploy(selectedContract, constructorArgs);
  };

  // Empty state - no compiled contracts
  if (contracts.length === 0) {
    return (
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <Rocket className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Deploy</h3>
            <p className="text-[11px] text-slate-500">To Tempo Network</p>
          </div>
        </div>

        {/* Empty State */}
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Code2 className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-[13px] font-medium text-slate-600">No contracts compiled</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Click &quot;Compile&quot; to build your contract
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Rocket className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Deploy</h3>
          <p className="text-[11px] text-slate-500">To Tempo Network</p>
        </div>
      </div>

      {/* Contract Selection */}
      <div className="space-y-3">
        {contracts.length > 1 ? (
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Select Contract
            </label>
            <ContractSelector
              contracts={contracts}
              selectedContract={selectedContract}
              onSelect={setSelectedContract}
              disabled={isDeploying}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-[13px] font-medium text-green-700">{contracts[0].name}</span>
            <span className="ml-auto text-[11px] text-green-600">Ready</span>
          </div>
        )}

        {/* Constructor Args */}
        {selectedContract && (
          <ConstructorArgsForm abi={selectedContract.abi} onChange={handleArgsChange} />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-[12px] text-red-600">{error.message}</p>
        </div>
      )}

      {/* Deploy Button */}
      <Button
        className="w-full h-11 text-[13px] font-semibold shadow-sm"
        disabled={!selectedContract || !isConnected || isDeploying}
        onClick={handleDeploy}
      >
        {isDeploying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : !isConnected ? (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Connect Wallet
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            Deploy Contract
          </>
        )}
      </Button>

      {/* Network Info */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>Tempo Testnet</span>
      </div>
    </div>
  );
}
