/**
 * Main deploy panel UI.
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import { Rocket, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  const handleArgsChange = useCallback((args: unknown[]) => {
    setConstructorArgs(args);
  }, []);

  const handleDeploy = async (): Promise<void> => {
    if (!selectedContract) return;
    await onDeploy(selectedContract, constructorArgs);
  };

  if (contracts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4" />
            Deploy
          </CardTitle>
          <CardDescription>Compile your contract first</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No compiled contracts available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4" />
          Deploy
        </CardTitle>
        <CardDescription>Deploy to Tempo testnet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ContractSelector
          contracts={contracts}
          selectedContract={selectedContract}
          onSelect={setSelectedContract}
          disabled={isDeploying}
        />

        {selectedContract && (
          <ConstructorArgsForm abi={selectedContract.abi} onChange={handleArgsChange} />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          disabled={!selectedContract || !isConnected || isDeploying}
          onClick={handleDeploy}
        >
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </>
          ) : !isConnected ? (
            'Connect wallet to deploy'
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Deploy Contract
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
