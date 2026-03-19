import { useState, useEffect, type ReactElement } from 'react';
import {
  Fingerprint,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Shield,
  Smartphone,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

export interface CreateWalletModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onCreateWallet: (walletName?: string) => Promise<void>;
  onSignIn?: () => void;
  accentColor?: string;
}

export function CreateWalletModal({
  isOpen,
  isLoading,
  onClose,
  onCreateWallet,
  onSignIn,
  accentColor = '#E07A5F',
}: CreateWalletModalProps): ReactElement {
  const [walletName, setWalletName] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setWalletName('');
      setCurrentStep(1);
    }
  }, [isOpen]);

  const handleClose = (): void => {
    if (!isLoading) {
      setWalletName('');
      onClose();
    }
  };

  const handleCreate = async (): Promise<void> => {
    if (!walletName.trim()) return;
    await onCreateWallet(walletName.trim());
  };

  const isValidName = walletName.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent hideClose className="max-w-[380px] p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">Create Wallet</DialogTitle>
        <DialogDescription className="sr-only">Create a new passkey wallet</DialogDescription>

        {/* Step Content — both panels rendered, slide via transform */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out will-change-transform"
            style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
          >
            {/* ── Step 1 ── */}
            <div className="w-1/2 flex-shrink-0 px-6 pt-8 pb-2" style={{ minWidth: '100%' }}>
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}10` }}
                >
                  <Fingerprint className="h-6 w-6" style={{ color: accentColor }} strokeWidth={1.5} />
                </div>
                <h2 className="text-[18px] font-bold text-[#2D3436] tracking-tight">
                  Passkey Wallet
                </h2>
                <p className="text-[13px] text-[#9B9590] mt-2 leading-relaxed max-w-[280px] mx-auto">
                  Your wallet is secured by biometrics. No passwords, no seed phrases — just you.
                </p>
              </div>

              <div className="mt-6 space-y-1.5">
                {[
                  { icon: Shield, text: 'No passwords or seed phrases' },
                  { icon: Fingerprint, text: 'Protected by Face ID or Touch ID' },
                  { icon: Lock, text: 'Private key never leaves your device' },
                  { icon: Smartphone, text: 'Syncs securely across your devices' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-3 px-1 py-1.5">
                    <item.icon className="h-4 w-4 flex-shrink-0 text-[#B5B0AA]" strokeWidth={1.75} />
                    <span className="text-[13px] text-[#6B6560]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Step 2 ── */}
            <div className="w-1/2 flex-shrink-0 px-6 pt-8 pb-2" style={{ minWidth: '100%' }}>
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}10` }}
                >
                  <Wallet className="h-6 w-6" style={{ color: accentColor }} strokeWidth={1.5} />
                </div>
                <h2 className="text-[18px] font-bold text-[#2D3436] tracking-tight">
                  Name Your Wallet
                </h2>
                <p className="text-[13px] text-[#9B9590] mt-2 leading-relaxed max-w-[280px] mx-auto">
                  This name is stored with your passkey for easy identification.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-[#B5B0AA] uppercase tracking-wider mb-1.5 block">
                    Wallet Name
                  </label>
                  <Input
                    placeholder="e.g., Personal, Business..."
                    value={walletName}
                    onChange={e => setWalletName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && isValidName && !isLoading) handleCreate();
                    }}
                    className="text-[14px] h-12 rounded-xl border-[#EDE9E3] bg-white focus:bg-white transition-all placeholder:text-[#C5C0BA]"
                    style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    maxLength={30}
                    disabled={isLoading}
                  />
                  {walletName.trim() ? (
                    <p className="mt-2 text-[12px] text-[#9B9590]">
                      Your passkey will be saved as <span className="font-semibold text-[#2D3436]">{walletName.trim()}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-[#C5C0BA]">
                      Give your wallet a memorable name
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]/60">
                  <Fingerprint className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#B5B0AA]" strokeWidth={1.75} />
                  <p className="text-[12px] text-[#9B9590] leading-relaxed">
                    You&apos;ll confirm with Face ID, Touch ID, or your device PIN next.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-6">
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-5">
            <div className="h-1 rounded-full transition-all duration-300" style={{ width: currentStep === 1 ? 16 : 6, backgroundColor: currentStep === 1 ? accentColor : '#EDE9E3' }} />
            <div className="h-1 rounded-full transition-all duration-300" style={{ width: currentStep === 2 ? 16 : 6, backgroundColor: currentStep === 2 ? accentColor : '#EDE9E3' }} />
          </div>

          {currentStep === 1 ? (
            <Button
              onClick={() => setCurrentStep(2)}
              className="w-full h-12 rounded-2xl text-[14px] font-semibold text-white transition-all duration-200"
              style={{ backgroundColor: accentColor }}
            >
              Get Started
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isLoading}
                className="h-12 px-4 rounded-2xl border-[#EDE9E3] hover:bg-[#F5F2ED]"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCreate}
                isLoading={isLoading}
                disabled={!isValidName}
                className="flex-1 h-12 rounded-2xl text-[14px] font-semibold text-white transition-all duration-200"
                style={{ backgroundColor: accentColor }}
              >
                Create Wallet
              </Button>
            </div>
          )}
        </div>

        {onSignIn && (
          <div className="border-t border-[#EDE9E3]/60 px-6 py-4">
            <p className="text-[13px] text-center text-[#9B9590]">
              Already have a wallet?{' '}
              <button
                onClick={onSignIn}
                disabled={isLoading}
                className="font-semibold transition-colors cursor-pointer disabled:opacity-50"
                style={{ color: accentColor }}
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
