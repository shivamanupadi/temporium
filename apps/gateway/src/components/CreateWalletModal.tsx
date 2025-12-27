import { useState, useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Wallet, ArrowRight, Shield, X, Smartphone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { modalAnimation } from '@/lib/utils';

interface CreateWalletModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onCreateWallet: (walletName?: string) => Promise<void>;
}

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
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            {...modalAnimation.content}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Create Wallet</h2>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Step Pills */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => !isLoading && setCurrentStep(1)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-all ${
                      currentStep === 1
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    1. About Passkeys
                  </button>
                  <div className="w-3 h-px bg-slate-200" />
                  <button
                    onClick={() => !isLoading && currentStep !== 1 && setCurrentStep(2)}
                    disabled={currentStep === 1 || isLoading}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-all ${
                      currentStep === 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    2. Name Wallet
                  </button>
                </div>
              </div>

              {/* Step Content with Slide Animation */}
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(-${(currentStep - 1) * 50}%)`,
                    width: '200%',
                  }}
                >
                  {/* Step 1: About Passkeys */}
                  <div className="w-1/2 flex-shrink-0 px-6 pb-4">
                    <div className="space-y-4">
                      {/* Icon & Description */}
                      <div className="text-center py-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <Fingerprint className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
                          What is a Passkey Wallet?
                        </h3>
                        <p className="text-[13px] text-gray-500">
                          A secure wallet protected by your device&apos;s biometrics
                        </p>
                      </div>

                      {/* Benefits */}
                      <div className="space-y-1">
                        {[
                          { icon: Shield, text: 'No passwords or seed phrases', color: '#10b981' },
                          {
                            icon: Fingerprint,
                            text: 'Protected by Face ID or Touch ID',
                            color: '#7c5cff',
                          },
                          {
                            icon: Lock,
                            text: 'Private key never leaves your device',
                            color: '#f59e0b',
                          },
                          {
                            icon: Smartphone,
                            text: 'Syncs securely across your devices',
                            color: '#06b6d4',
                          },
                        ].map(benefit => (
                          <div key={benefit.text} className="flex items-center gap-3 py-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${benefit.color}15` }}
                            >
                              <benefit.icon className="h-4 w-4" style={{ color: benefit.color }} />
                            </div>
                            <span className="text-[13px] text-gray-700">{benefit.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Name Wallet */}
                  <div className="w-1/2 flex-shrink-0 px-6 pb-4">
                    <div className="space-y-4">
                      {/* Icon & Description */}
                      <div className="text-center py-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <Wallet className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
                          Name Your Wallet
                        </h3>
                        <p className="text-[13px] text-gray-500">
                          Give your wallet a name to identify it easily
                        </p>
                      </div>

                      {/* Wallet Name Input */}
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                          Wallet Name <span className="text-red-400">*</span>
                        </label>
                        <Input
                          placeholder="e.g., Personal, Business, Savings..."
                          value={walletName}
                          onChange={e => setWalletName(e.target.value)}
                          className="text-[14px] h-12"
                          maxLength={30}
                          disabled={isLoading}
                        />
                        <p className="text-[11px] text-gray-400 mt-2">
                          Saved as:{' '}
                          <span
                            className={`font-medium ${walletName.trim() ? 'text-gray-600' : 'text-gray-400'}`}
                          >
                            Temporium: {walletName.trim() || 'Enter a name'}
                          </span>
                        </p>
                      </div>

                      {/* Info Box */}
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <Smartphone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[12px] text-gray-500 leading-relaxed">
                          You&apos;ll be prompted to authenticate using Face ID, Touch ID, or your
                          device PIN.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex gap-3">
                {currentStep === 1 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => setCurrentStep(2)} className="flex-1 h-11">
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      disabled={isLoading}
                      className="flex-1 h-11"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleCreate}
                      isLoading={isLoading}
                      disabled={!isValidName}
                      className="flex-1 h-11"
                    >
                      <Fingerprint className="h-4 w-4" />
                      Create Wallet
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
