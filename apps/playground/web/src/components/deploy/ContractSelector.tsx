/**
 * Dropdown selector for compiled contracts.
 */

import type React from 'react';
import { FileCode2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CompiledContract } from '@/lib/compiler';

interface ContractSelectorProps {
  contracts: CompiledContract[];
  selectedContract: CompiledContract | null;
  onSelect: (contract: CompiledContract) => void;
  disabled?: boolean;
}

export function ContractSelector({
  contracts,
  selectedContract,
  onSelect,
  disabled = false,
}: ContractSelectorProps): React.ReactElement {
  const handleValueChange = (name: string): void => {
    const contract = contracts.find(c => c.name === name);
    if (contract) {
      onSelect(contract);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Contract</label>
      <Select
        value={selectedContract?.name}
        onValueChange={handleValueChange}
        disabled={disabled || contracts.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a contract to deploy">
            {selectedContract && (
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                {selectedContract.name}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {contracts.map(contract => (
            <SelectItem key={contract.name} value={contract.name}>
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                {contract.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
