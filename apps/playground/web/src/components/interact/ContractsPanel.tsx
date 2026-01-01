/**
 * Deployed contracts panel - Clean, modern design matching DeployPanel.
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { Blocks, ExternalLink, Clock, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddressDisplay } from '@/components/AddressDisplay';
import { ContractInteractor } from './ContractInteractor';
import { useDeployedContracts, useDeleteDeployedContract } from '@/hooks/useDeployedContracts';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import type { DeployedContract } from '@/lib/contracts-storage';

interface ContractsPanelProps {
  projectId?: string;
}

export function ContractsPanel({ projectId }: ContractsPanelProps): React.ReactElement {
  const { data: allContracts, isLoading } = useDeployedContracts();
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);

  // Filter contracts by project if projectId is provided
  const contracts = useMemo(() => {
    if (!allContracts) return [];
    if (projectId) {
      return allContracts.filter(c => c.projectId === projectId);
    }
    return allContracts;
  }, [allContracts, projectId]);

  const toggleExpanded = (address: string): void => {
    setExpandedAddress(prev => (prev === address ? null : address));
  };

  // Empty state
  if (!isLoading && (!contracts || contracts.length === 0)) {
    return (
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <Blocks className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Contracts</h3>
            <p className="text-[11px] text-slate-500">Deployed from this project</p>
          </div>
        </div>

        {/* Empty State */}
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Blocks className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-[13px] font-medium text-slate-600">No contracts deployed</p>
            <p className="mt-1 text-[11px] text-slate-400">Deploy a contract to interact with it</p>
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
          <Blocks className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Contracts</h3>
          <p className="text-[11px] text-slate-500">{contracts.length} deployed</p>
        </div>
      </div>

      {/* Contracts List */}
      <div className="space-y-2">
        {contracts.map(contract => (
          <ContractItem
            key={contract.address}
            contract={contract}
            isExpanded={expandedAddress === contract.address}
            onToggle={() => toggleExpanded(contract.address)}
          />
        ))}
      </div>
    </div>
  );
}

interface ContractItemProps {
  contract: DeployedContract;
  isExpanded: boolean;
  onToggle: () => void;
}

function ContractItem({ contract, isExpanded, onToggle }: ContractItemProps): React.ReactElement {
  const deleteContract = useDeleteDeployedContract();

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (confirm(`Remove "${contract.name}" from your list?`)) {
      deleteContract.mutate(contract.address);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Contract Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-slate-900 truncate">{contract.name}</span>
            <a
              href={getExplorerAddressUrl(contract.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-primary transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <AddressDisplay address={contract.address} chars={6} showCopy={false} />
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(contract.deployedAt)}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
        </Button>
      </button>

      {/* Expanded Content - ContractInteractor */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-3 bg-slate-50/50">
          <ContractInteractor address={contract.address} abi={contract.abi} />
        </div>
      )}
    </div>
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
