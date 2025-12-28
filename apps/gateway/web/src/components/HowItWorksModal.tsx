import { type ReactElement, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Fingerprint, Database, Shield, ExternalLink, Copy, Check } from 'lucide-react';
import { getWalletApiUrl } from '@/lib/api';
import { modalAnimation } from '@/lib/utils';

interface ContractInfo {
  address: string;
  name: string;
  explorerUrl: string;
}

interface ContractsData {
  chain: {
    id: number;
    name: string;
    explorerUrl: string;
  };
  contracts: {
    passkeyRegistry: ContractInfo;
  };
}

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps): ReactElement | null {
  const [contractsData, setContractsData] = useState<ContractsData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch(`${getWalletApiUrl()}/contracts`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setContractsData(data.data);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleCopy = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      icon: Fingerprint,
      title: 'Passkey Auth',
      desc: 'Sign in with Face ID, Touch ID, or PIN',
    },
    {
      icon: Database,
      title: 'On-Chain Storage',
      desc: 'Public key stored on Tempo blockchain',
    },
    {
      icon: Shield,
      title: 'Permanent Access',
      desc: 'Recover wallet anytime via blockchain',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...modalAnimation.backdrop}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 cursor-pointer"
          />

          <motion.div
            {...modalAnimation.content}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[360px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-gray-900">How It Works</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              {/* Steps */}
              <div className="px-5 pb-4">
                <div className="space-y-3">
                  {steps.map(step => (
                    <div key={step.title} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <step.icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="pt-0.5">
                        <div className="text-[13px] font-medium text-gray-900">{step.title}</div>
                        <div className="text-[12px] text-gray-500">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract Info */}
              {contractsData && (
                <div className="mx-5 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Smart Contract
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <Database className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-gray-900">
                          {contractsData.contracts.passkeyRegistry.name}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {formatAddress(contractsData.contracts.passkeyRegistry.address)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(contractsData.contracts.passkeyRegistry.address)}
                        className="p-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                      <a
                        href={contractsData.contracts.passkeyRegistry.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
                        title="View on explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-5 pb-5">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-[13px] font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
