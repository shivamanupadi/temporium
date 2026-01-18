import { type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Wallet, X, ExternalLink, Sparkles } from 'lucide-react';
import { modalAnimation } from '@/lib/utils';

interface WalletOption {
  id: 'passkey' | 'injected';
  name: string;
  description: string;
  icon: typeof Fingerprint;
  color: string;
  available: boolean;
}

interface WalletSelectModalProps {
  isOpen: boolean;
  isLoading: boolean;
  hasInjectedWallet: boolean;
  onClose: () => void;
  onSelectPasskey: () => void;
  onSelectInjected: () => void;
  onCreateWallet?: () => void;
}

export function WalletSelectModal({
  isOpen,
  isLoading,
  hasInjectedWallet,
  onClose,
  onSelectPasskey,
  onSelectInjected,
  onCreateWallet,
}: WalletSelectModalProps): ReactElement | null {
  const walletOptions: WalletOption[] = [
    {
      id: 'passkey',
      name: 'Passkey',
      description: 'Sign in with Face ID or Touch ID',
      icon: Fingerprint,
      color: '#7c5cff',
      available: true,
    },
    {
      id: 'injected',
      name: 'Browser Wallet',
      description: hasInjectedWallet ? 'Connect MetaMask, Brave, etc.' : 'No wallet detected',
      icon: Wallet,
      color: '#f6851b',
      available: hasInjectedWallet,
    },
  ];

  const handleSelect = (option: WalletOption): void => {
    if (!option.available || isLoading) return;

    if (option.id === 'passkey') {
      onSelectPasskey();
    } else {
      onSelectInjected();
    }
  };

  const handleClose = (): void => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[360px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Sign In</h2>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-[13px] text-gray-500">Choose how you&apos;d like to sign in</p>
              </div>

              {/* Wallet Options */}
              <div className="px-6 pb-4 space-y-2">
                {walletOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option)}
                    disabled={!option.available || isLoading}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      option.available
                        ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                        : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${option.color}15` }}
                    >
                      <option.icon className="h-5 w-5" style={{ color: option.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-medium text-gray-900">{option.name}</p>
                      <p className="text-[12px] text-gray-500">{option.description}</p>
                    </div>
                    {option.available && <ExternalLink className="h-4 w-4 text-gray-300" />}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 space-y-3">
                <p className="text-[11px] text-gray-400 text-center">
                  Browser wallets will be prompted to add Tempo network
                </p>

                {/* Create wallet option */}
                {onCreateWallet && (
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        onClose();
                        onCreateWallet();
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 p-3 text-[13px] text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Don&apos;t have a wallet? <strong>Create one</strong></span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
