/**
 * Modal shown after successful contract deployment.
 */

import type React from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle, ExternalLink, ArrowRight } from 'lucide-react';
import type { Address, Hash } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/tempo-client';

interface DeploySuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractName: string;
  contractAddress: Address;
  txHash: Hash;
}

export function DeploySuccessModal({
  open,
  onOpenChange,
  contractName,
  contractAddress,
  txHash,
}: DeploySuccessModalProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Contract Deployed
          </DialogTitle>
          <DialogDescription>{contractName} has been deployed to Tempo testnet</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contract Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Contract Address</label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 truncate text-sm">{contractAddress}</code>
              <CopyButton text={contractAddress} />
            </div>
          </div>

          {/* Transaction Hash */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transaction Hash</label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 truncate text-sm">{txHash}</code>
              <CopyButton text={txHash} />
            </div>
          </div>

          {/* Explorer Links */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Transaction
              </a>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={getExplorerAddressUrl(contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Contract
              </a>
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="flex-1" asChild>
            <Link
              to="/contracts/$address"
              params={{ address: contractAddress }}
              onClick={() => onOpenChange(false)}
            >
              Interact
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
