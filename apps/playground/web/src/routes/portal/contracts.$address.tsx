import type React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Blocks, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressDisplay } from '@/components/AddressDisplay';
import { ContractInteractor } from '@/components/interact';
import { useDeployedContract } from '@/hooks/useDeployedContracts';
import { getExplorerAddressUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/contracts/$address')({
  component: ContractPage,
});

function ContractPage(): React.ReactElement {
  const { address } = Route.useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useDeployedContract(address as `0x${string}`);

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-5 w-96" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <Blocks className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Contract not found</p>
        <p className="text-sm text-muted-foreground">
          This contract may have been removed from your local storage.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: '/portal/contracts' })}>
          Back to Contracts
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Button variant="ghost" className="mb-6" asChild>
        <Link to="/portal/contracts">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contracts
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold">
          <Blocks className="h-6 w-6" />
          {contract.name}
        </h1>
        <div className="flex items-center gap-2">
          <AddressDisplay address={contract.address} chars={8} />
          <a
            href={getExplorerAddressUrl(contract.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <ContractInteractor address={contract.address} abi={contract.abi} />
    </div>
  );
}
