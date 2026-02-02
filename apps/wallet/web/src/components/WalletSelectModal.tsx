import { type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, X, Sparkles, Wallet } from 'lucide-react';
import { modalAnimation } from '@/lib/utils';

interface WalletSelectModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSelectPasskey: () => void;
  onCreateWallet?: () => void;
  onInjectedConnect?: () => void;
  hasInjectedWallet?: boolean;
}

export function WalletSelectModal({
  isOpen,
  isLoading,
  onClose,
  onSelectPasskey,
  onCreateWallet,
  onInjectedConnect,
  hasInjectedWallet,
}: WalletSelectModalProps): ReactElement | null {
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
                <p className="text-[13px] text-gray-500">
                  Sign in with your passkey to access your wallet
                </p>
              </div>

              {/* Sign In Options */}
              <div className="px-6 pb-4 space-y-3">
                {/* Passkey Sign In */}
                <button
                  onClick={onSelectPasskey}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#7c5cff15' }}
                  >
                    <Fingerprint className="h-5 w-5" style={{ color: '#7c5cff' }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-medium text-gray-900">Continue with Passkey</p>
                    <p className="text-[12px] text-gray-500">Use Face ID or Touch ID</p>
                  </div>
                </button>

                {/* Injected Wallet Option */}
                {hasInjectedWallet && onInjectedConnect && (
                  <button
                    onClick={onInjectedConnect}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                      <Wallet className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-medium text-gray-900">Browser Wallet</p>
                      <p className="text-[12px] text-gray-500">MetaMask or other wallet</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
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
                      <span>
                        Don&apos;t have a wallet? <strong>Create one</strong>
                      </span>
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
