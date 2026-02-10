import { useState, useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Shield,
  X,
  Smartphone,
  Lock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { modalAnimation } from '@/lib/utils';

interface CreateWalletModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onCreateWallet: (walletName?: string) => Promise<void>;
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
}: CreateWalletModalProps): ReactElement | null {
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            {...modalAnimation.backdrop}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Modal */}
          <motion.div
            {...modalAnimation.content}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/10">
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
                    <X className="h-4 w-4 text-[#9B9590]" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mt-4 flex gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[#E07A5F] transition-all duration-300" />
                  <div
                    className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                      currentStep === 2 ? 'bg-[#E07A5F]' : 'bg-[#EDE9E3]'
                    }`}
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
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#E07A5F]/20 via-[#9B72CF]/15 to-[#5B9A6F]/20 blur-lg" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E07A5F]/10 to-[#9B72CF]/10 border border-[#EDE9E3] flex items-center justify-center">
                          <Fingerprint className="h-7 w-7 text-[#E07A5F]" />
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
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#9B72CF]/20 via-[#E07A5F]/15 to-[#5B9A6F]/20 blur-lg" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9B72CF]/10 to-[#E07A5F]/10 border border-[#EDE9E3] flex items-center justify-center">
                          <Wallet className="h-7 w-7 text-[#9B72CF]" />
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
                        className="text-[14px] h-12 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:bg-white focus:border-[#E07A5F]/40 transition-all"
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
                        className={`mt-2 flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-300 ${
                          walletName.trim()
                            ? 'border-[#E07A5F]/20 bg-[#E07A5F]/[0.03]'
                            : 'border-[#EDE9E3] bg-[#FDFBF8]'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                            walletName.trim() ? 'bg-[#E07A5F]/10' : 'bg-[#EDE9E3]'
                          }`}
                        >
                          <Wallet
                            className={`h-4 w-4 transition-colors duration-300 ${
                              walletName.trim() ? 'text-[#E07A5F]' : 'text-[#B5B0AA]'
                            }`}
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
              <div className="px-6 py-4 border-t border-[#EDE9E3]/60 bg-[#FDFBF8]/50">
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
                    <Button onClick={() => setCurrentStep(2)} className="flex-1 h-11 font-semibold">
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
                    >
                      <Fingerprint className="h-4 w-4" />
                      Create Wallet
                    </Button>
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
