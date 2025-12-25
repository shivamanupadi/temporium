import { type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Fingerprint,
  Globe,
  Shield,
  ArrowRight,
  Lock,
  Database,
  CheckCircle2,
} from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps): ReactElement | null {
  const steps = [
    {
      icon: Fingerprint,
      title: 'Passkey Authentication',
      description:
        'Sign in using Face ID, Touch ID, or your device PIN. No passwords to remember or lose. Your private key never leaves your device.',
      color: '#7c5cff',
    },
    {
      icon: Database,
      title: 'On-Chain Storage',
      description:
        'Your public key is stored on the Tempo blockchain, not in a centralised database. This means no single point of failure.',
      color: '#0073e6',
    },
    {
      icon: Lock,
      title: 'Immutable & Permanent',
      description:
        'Smart contracts cannot be deleted or modified. Your wallet access is guaranteed as long as the blockchain exists.',
      color: '#10b981',
    },
  ];

  const benefits = [
    'No seed phrases to backup',
    'No passwords to remember',
    'No centralised servers',
    'No account recovery needed',
    'Works across all your devices',
    'Phishing resistant by design',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 cursor-pointer"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[480px] max-h-[90vh] overflow-y-auto z-50 px-4"
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">How It Works</h2>
                      <p className="text-[13px] text-gray-500">Decentralised passkey wallet</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-6">
                {/* Steps */}
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.title} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${step.color}15` }}
                        >
                          <step.icon className="h-5 w-5" style={{ color: step.color }} />
                        </div>
                        {index < steps.length - 1 && (
                          <div className="w-px h-full bg-gray-200 my-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <h3 className="text-[14px] font-semibold text-gray-900 mb-1">
                          {step.title}
                        </h3>
                        <p className="text-[13px] text-gray-500 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Benefits */}
                <div>
                  <h3 className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Why This Matters
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {benefits.map(benefit => (
                      <div
                        key={benefit}
                        className="flex items-center gap-2 text-[12px] text-gray-600"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Key Point */}
                <div className="bg-gradient-to-br from-primary/5 to-[#0073e6]/5 rounded-xl p-4 border border-primary/10">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Lock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-900 mb-1">
                        You Never Lose Access
                      </h4>
                      <p className="text-[12px] text-gray-600 leading-relaxed">
                        Your public key is stored in an immutable smart contract on the blockchain.
                        Even if Temporium disappears, you can always recover your wallet using any
                        blockchain explorer or compatible app. Your access is guaranteed forever.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Got it
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
