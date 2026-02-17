import { useState, useEffect, type ReactElement } from 'react';
import {
  Fingerprint,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Shield,
  Smartphone,
  Lock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

export interface CreateWalletModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onCreateWallet: (walletName?: string) => Promise<void>;
  /** Called when user clicks "Sign in" link in footer */
  onSignIn?: () => void;
  /** Primary accent color (defaults to coral #E07A5F) */
  accentColor?: string;
}

const benefits = [
  {
    icon: Shield,
    text: 'No passwords or seed phrases',
    color: '#5B9A6F',
  },
  {
    icon: Fingerprint,
    text: 'Protected by Face ID or Touch ID',
    color: '#9B72CF',
  },
  {
    icon: Lock,
    text: 'Private key never leaves your device',
    color: '#E07A5F',
  },
  {
    icon: Smartphone,
    text: 'Syncs securely across your devices',
    color: '#5B9A6F',
  },
];

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
      <DialogContent hideClose className="max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">Create Wallet</DialogTitle>
        <DialogDescription className="sr-only">Create a new passkey wallet</DialogDescription>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#2D3436]">Create Wallet</h2>
              <p className="text-[12px] text-[#9B9590] mt-0.5">Step {currentStep} of 2</p>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="p-2 -mr-1 rounded-xl hover:bg-[#F5F2ED] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9B9590]"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 h-1 rounded-full transition-all duration-300" style={{ backgroundColor: accentColor }} />
            <div
              className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{ backgroundColor: currentStep === 2 ? accentColor : '#EDE9E3' }}
            />
          </div>
        </div>

        {/* Step Content — CSS transform slide (GPU-accelerated, no layout shift) */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-250 ease-out will-change-transform"
            style={{
              width: '200%',
              transform: `translateX(-${(currentStep - 1) * 50}%)`,
            }}
          >
            {/* Step 1: About Passkeys */}
            <div className="w-1/2 flex-shrink-0 px-6 pb-5">
              {/* Hero */}
              <div className="text-center mb-5">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div
                    className="relative w-16 h-16 rounded-2xl border border-[#EDE9E3] flex items-center justify-center"
                    style={{ background: `linear-gradient(to bottom right, ${accentColor}1A, #9B72CF1A)` }}
                  >
                    <Fingerprint className="h-7 w-7" style={{ color: accentColor }} />
                  </div>
                </div>
                <h3 className="text-[16px] font-semibold text-[#2D3436] mb-1">
                  Passkey Wallet
                </h3>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">
                  Secured by your device&apos;s biometrics
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                {benefits.map(benefit => (
                  <div
                    key={benefit.text}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#FDFBF8] transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${benefit.color}12` }}
                    >
                      <benefit.icon
                        className="h-4 w-4"
                        style={{ color: benefit.color }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className="text-[13px] text-[#4D5456] font-medium">
                      {benefit.text}
                    </span>
                    <CheckCircle
                      className="h-3.5 w-3.5 ml-auto flex-shrink-0"
                      style={{ color: benefit.color }}
                      strokeWidth={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Name Wallet */}
            <div className="w-1/2 flex-shrink-0 px-6 pb-5">
              {/* Hero */}
              <div className="text-center mb-5">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div
                    className="relative w-16 h-16 rounded-2xl border border-[#EDE9E3] flex items-center justify-center"
                    style={{ background: `linear-gradient(to bottom right, #9B72CF1A, ${accentColor}1A)` }}
                  >
                    <Wallet className="h-7 w-7" style={{ color: accentColor }} />
                  </div>
                </div>
                <h3 className="text-[16px] font-semibold text-[#2D3436] mb-1">
                  Name Your Wallet
                </h3>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">
                  Choose a name to identify your wallet
                </p>
              </div>

              {/* Wallet Name Input */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Wallet Name
                </label>
                <Input
                  placeholder="e.g., Personal, Business, Savings..."
                  value={walletName}
                  onChange={e => setWalletName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && isValidName && !isLoading) handleCreate();
                  }}
                  className="text-[14px] h-12 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:bg-white transition-all"
                  style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                  maxLength={30}
                  disabled={isLoading}
                />

                {/* Live preview */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#EDE9E3]" />
                  <p className="text-[11px] text-[#B5B0AA] px-1">preview</p>
                  <div className="flex-1 h-px bg-[#EDE9E3]" />
                </div>
                <div
                  className="mt-2 flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-300"
                  style={walletName.trim()
                    ? { borderColor: `${accentColor}33`, backgroundColor: `${accentColor}08` }
                    : { borderColor: '#EDE9E3', backgroundColor: '#FDFBF8' }
                  }
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                    style={{ backgroundColor: walletName.trim() ? `${accentColor}1A` : '#EDE9E3' }}
                  >
                    <Wallet
                      className="h-4 w-4 transition-colors duration-300"
                      style={{ color: walletName.trim() ? accentColor : '#B5B0AA' }}
                      strokeWidth={1.75}
                    />
                  </div>
                  <span
                    className={`text-[13px] font-medium transition-colors duration-300 ${
                      walletName.trim() ? 'text-[#2D3436]' : 'text-[#B5B0AA]'
                    }`}
                  >
                    Temporium: {walletName.trim() || 'Your wallet name'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#9B72CF]/[0.05] border border-[#9B72CF]/10">
                <Fingerprint
                  className="h-4 w-4 text-[#9B72CF] mt-0.5 flex-shrink-0"
                  strokeWidth={1.75}
                />
                <p className="text-[12px] text-[#6B6560] leading-relaxed">
                  You&apos;ll authenticate with Face ID, Touch ID, or your device PIN to
                  create your passkey.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#EDE9E3]/60">
          {currentStep === 1 ? (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 h-11 text-[#6B6560]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setCurrentStep(2)}
                className="flex-1 h-11 font-semibold"
                style={{ backgroundColor: accentColor }}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isLoading}
                className="h-11 px-4 border-[#EDE9E3]"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCreate}
                isLoading={isLoading}
                disabled={!isValidName}
                className="flex-1 h-11 font-semibold"
                style={{ backgroundColor: accentColor }}
              >
                <Fingerprint className="h-4 w-4" />
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
                className="font-semibold text-[#E07A5F] hover:text-[#D4694F] transition-colors cursor-pointer disabled:opacity-50"
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
