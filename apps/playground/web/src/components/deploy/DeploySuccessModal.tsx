/**
 * Modal shown after successful contract deployment - Clean, celebratory design.
 */

import type React from 'react';
import { Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ExternalLink, ArrowRight, X, Copy, Check, Sparkles } from 'lucide-react';
import type { Address, Hash } from 'viem';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/tempo-client';
import { modalAnimation } from '@/lib/utils';

interface DeploySuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractName: string;
  contractAddress: Address;
  txHash: Hash;
}

function CopyableField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            View
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5">
        <code className="flex-1 truncate text-[12px] text-slate-700 font-mono">{value}</code>
        <button
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
}

export function DeploySuccessModal({
  open,
  onOpenChange,
  contractName,
  contractAddress,
  txHash,
}: DeploySuccessModalProps): React.ReactElement | null {
  const handleClose = (): void => onOpenChange(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            {...modalAnimation.backdrop}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            {...modalAnimation.content}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Header with close button */}
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-start justify-between">
                  <div />
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Success Icon & Message */}
              <div className="px-6 pb-6 text-center">
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">Deployment Successful!</h2>
                <p className="mt-1.5 text-[13px] text-slate-500">
                  <span className="font-semibold text-slate-700">{contractName}</span> has been
                  deployed to Tempo
                </p>
              </div>

              {/* Contract Details */}
              <div className="px-6 pb-6 space-y-3">
                <CopyableField
                  label="Contract Address"
                  value={contractAddress}
                  href={getExplorerAddressUrl(contractAddress)}
                />
                <CopyableField
                  label="Transaction Hash"
                  value={txHash}
                  href={getExplorerTxUrl(txHash)}
                />
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 space-y-3">
                <Button className="w-full h-11 text-[13px] font-semibold shadow-sm" asChild>
                  <Link
                    to="/portal/contracts/$address"
                    params={{ address: contractAddress }}
                    onClick={handleClose}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Interact with Contract
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full h-10 text-[13px]" onClick={handleClose}>
                  Continue Editing
                </Button>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>Deployed to Tempo Testnet</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
