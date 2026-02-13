import { type ReactElement } from 'react';
import { Fingerprint, Sparkles, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';

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
}: WalletSelectModalProps): ReactElement {
  const handleClose = (open: boolean): void => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-2">Sign In</DialogTitle>
          <DialogDescription className="text-[13px] text-gray-500">
            Sign in with your passkey to access your wallet
          </DialogDescription>
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
              style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}
            >
              <Fingerprint className="h-5 w-5" style={{ color: 'var(--primary)' }} />
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
      </DialogContent>
    </Dialog>
  );
}
