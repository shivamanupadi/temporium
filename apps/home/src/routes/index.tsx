import { createFileRoute } from '@tanstack/react-router';
import { type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Zap, Wallet, Server, ArrowRight, Twitter, CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.temporium.xyz';
const NODE_MANAGER_URL = import.meta.env.VITE_NODE_MANAGER_URL || 'https://node.temporium.xyz';

function HomePage(): ReactElement {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" strokeWidth={2} />
            <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Temporium
            </span>
          </div>
          <a
            href="https://x.com/HelloTemporium"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-900 transition-colors"
          >
            <Twitter className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative pt-24 pb-12 sm:pt-32 sm:pb-20 md:pt-40 md:pb-28 px-4 sm:px-6 bg-white overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(to right, #f1f5f9 1px, transparent 1px),
            linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-slate-50 border border-slate-200 mb-6 sm:mb-8">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7c5cff]" />
                <span className="text-[13px] sm:text-sm font-medium text-slate-700">
                  Built for Tempo Blockchain
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-slate-900 leading-[1.1] tracking-tight">
                Your Tools for
                <br />
                Tempo Blockchain
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg md:text-xl text-slate-600 mb-6 sm:mb-8 leading-relaxed font-light max-w-lg">
                Everything you need to interact with Tempo. Manage your wallet or run your own
                infrastructure node.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-8 sm:mb-10 text-[13px] sm:text-sm font-medium text-slate-700">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#7c5cff]" />
                  <span>Passkey Auth</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#7c5cff]" />
                  <span>One-Click Setup</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#7c5cff]" />
                  <span>Web Dashboard</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <a
                  href={GATEWAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#7c5cff] hover:bg-[#6b4fee] text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg text-[14px] sm:text-[15px] font-medium transition-colors"
                >
                  Open Gateway
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={NODE_MANAGER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg text-[14px] sm:text-[15px] font-medium border-2 border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Run a Node
                </a>
              </div>
            </motion.div>

            {/* Right Column - Products Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="space-y-3 sm:space-y-4"
            >
              {/* Gateway Card */}
              <a
                href={GATEWAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="relative bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-5 sm:p-8 hover:border-slate-300 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="mt-0.5 shrink-0">
                      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#7c5cff]/15 flex items-center justify-center">
                        <Wallet className="w-5 h-5 sm:w-7 sm:h-7 text-[#7c5cff]" strokeWidth={2} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                          Gateway
                        </h3>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#7c5cff] group-hover:translate-x-0.5 transition-all duration-300" />
                      </div>
                      <p className="text-[13px] sm:text-[15px] text-slate-600 leading-relaxed">
                        Your wallet for Tempo. Send, receive, swap tokens, provide liquidity, and
                        create TIP20 assets.
                      </p>
                    </div>
                  </div>
                </div>
              </a>

              {/* Node Manager Card */}
              <a
                href={NODE_MANAGER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="relative bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-5 sm:p-8 hover:border-slate-300 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="mt-0.5 shrink-0">
                      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#0073e6]/15 flex items-center justify-center">
                        <Server className="w-5 h-5 sm:w-7 sm:h-7 text-[#0073e6]" strokeWidth={2} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                          Node Manager
                        </h3>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#0073e6] group-hover:translate-x-0.5 transition-all duration-300" />
                      </div>
                      <p className="text-[13px] sm:text-[15px] text-slate-600 leading-relaxed">
                        Run your own Tempo RPC node. One-click deployment with web dashboard,
                        snapshot sync, and monitoring.
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-4 sm:px-6 py-6 sm:py-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[12px] sm:text-[13px]">Powered by</span>
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] sm:text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Tempo
            </a>
          </div>
          <div className="text-[12px] sm:text-[13px] text-slate-400">Fast, secure, and simple.</div>
        </div>
      </footer>
    </div>
  );
}
