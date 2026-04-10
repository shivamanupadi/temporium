import { type ReactElement } from 'react';
import { Fingerprint, Globe, Sparkles, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';

interface WalletSelectModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSelectPasskey: () => void;
  onCreateWallet?: () => void;
  onInjectedConnect?: () => void;
  onTempoWalletConnect?: () => void;
  hasInjectedWallet?: boolean;
}

export function WalletSelectModal({
  isOpen,
  isLoading,
  onClose,
  onSelectPasskey,
  onCreateWallet,
  onInjectedConnect,
  onTempoWalletConnect,
  hasInjectedWallet,
}: WalletSelectModalProps): ReactElement {
  const handleClose = (open: boolean): void => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[360px] p-0 gap-0 rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-[#2D3436] mb-2">Sign In</DialogTitle>
          <DialogDescription className="text-[13px] text-[#9B9590]">
            Sign in with your passkey to access your wallet
          </DialogDescription>
        </div>

        {/* Sign In Options */}
        <div className="px-6 pb-4 space-y-3">
          {/* Passkey Sign In */}
          <button
            onClick={onSelectPasskey}
            disabled={isLoading}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E3] hover:border-[#E07A5F]/30 hover:bg-[#F5F2ED] transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#E07A5F]/8">
              <Fingerprint className="h-5 w-5 text-[#E07A5F]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-medium text-[#2D3436]">Continue with Passkey</p>
              <p className="text-[12px] text-[#9B9590]">Use Face ID or Touch ID</p>
            </div>
          </button>

          {/* Tempo Wallet Option */}
          {onTempoWalletConnect && (
            <button
              onClick={onTempoWalletConnect}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E3] hover:border-[#9B72CF]/30 hover:bg-[#F5F2ED] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#9B72CF]/8">
                <Globe className="h-5 w-5 text-[#9B72CF]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-[#2D3436]">Tempo Wallet</p>
                <p className="text-[12px] text-[#9B9590]">Connect your Tempo account</p>
              </div>
            </button>
          )}

          {/* Injected Wallet Option */}
          {hasInjectedWallet && onInjectedConnect && (
            <button
              onClick={onInjectedConnect}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E3] hover:border-[#EDE9E3] hover:bg-[#F5F2ED] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F5F2ED]">
                <Wallet className="h-5 w-5 text-[#6B6560]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-[#2D3436]">Browser Wallet</p>
                <p className="text-[12px] text-[#9B9590]">MetaMask or other wallet</p>
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          {onCreateWallet && (
            <div className="pt-3 border-t border-[#F5F2ED]">
              <button
                onClick={() => {
                  onClose();
                  onCreateWallet();
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 p-3 text-[13px] text-[#E07A5F] hover:bg-[#E07A5F]/5 rounded-lg transition-colors disabled:opacity-50"
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
