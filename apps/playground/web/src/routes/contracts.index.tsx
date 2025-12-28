import type React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Blocks, ExternalLink, Clock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressDisplay } from '@/components/AddressDisplay';
import { useDeployedContracts, useDeleteDeployedContract } from '@/hooks/useDeployedContracts';
import { getExplorerAddressUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/contracts/')({
  component: ContractsIndexPage,
});

function ContractsIndexPage(): React.ReactElement {
  const { data: contracts, isLoading } = useDeployedContracts();
  const deleteContract = useDeleteDeployedContract();

  const handleDelete = (address: `0x${string}`): void => {
    if (confirm('Remove this contract from your list?')) {
      deleteContract.mutate(address);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deployed Contracts</h1>
        <p className="text-sm text-muted-foreground">
          Contracts you&apos;ve deployed to Tempo testnet
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !contracts || contracts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contracts.map(contract => (
            <ContractCard
              key={contract.address}
              contract={contract}
              onDelete={() => handleDelete(contract.address)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <Blocks className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-medium">No contracts deployed</h3>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        Deploy a contract from the editor to see it here
      </p>
      <Link to="/editor" className="text-sm font-medium text-primary hover:underline">
        Go to Editor
      </Link>
    </div>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border p-4">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="mb-4 h-4 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

interface ContractCardProps {
  contract: {
    address: `0x${string}`;
    name: string;
    deployedAt: Date;
  };
  onDelete: () => void;
}

function ContractCard({ contract, onDelete }: ContractCardProps): React.ReactElement {
  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card className="group relative transition-colors hover:bg-accent/50">
      <Link to="/contracts/$address" params={{ address: contract.address }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Blocks className="h-4 w-4" />
            {contract.name}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <AddressDisplay address={contract.address} showCopy={false} />
            <a
              href={getExplorerAddressUrl(contract.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(contract.deployedAt)}
          </div>
        </CardContent>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleDeleteClick}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </Card>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
