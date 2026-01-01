import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wallet, Server, ArrowRight, Twitter, Mail, Code2, X } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.temporium.xyz';
const NODE_MANAGER_URL = import.meta.env.VITE_NODE_MANAGER_URL || 'https://node.temporium.xyz';

const products = [
  {
    id: 'gateway',
    title: 'Gateway',
    tagline: 'Your Wallet',
    description:
      'Send, receive, swap tokens, provide liquidity, and create TIP20 assets. Secured by passkeys.',
    icon: Wallet,
    color: '#7c5cff',
    href: GATEWAY_URL,
    available: true,
  },
  {
    id: 'node-manager',
    title: 'Node Manager',
    tagline: 'Your Infrastructure',
    description:
      'Deploy your own Tempo RPC node. One-click setup with dashboard, snapshot sync, and monitoring.',
    icon: Server,
    color: '#fb7185',
    href: NODE_MANAGER_URL,
    available: false,
  },
  {
    id: 'playground',
    title: 'Playground',
    tagline: 'Your Studio',
    description:
      'Write, compile, and deploy Solidity contracts. Full editor with one-click deployment.',
    icon: Code2,
    color: '#34d399',
    href: '#',
    available: false,
  },
];

function HomePage(): ReactElement {
  const [selectedProduct, setSelectedProduct] = useState<(typeof products)[number] | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white" />
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-violet-500/[0.07] rounded-full blur-[140px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.05] rounded-full blur-[120px] translate-y-1/3" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-emerald-500/[0.04] rounded-full blur-[100px] translate-x-1/2" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2.5"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                <Zap className="relative w-6 h-6 text-primary" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">Temporium</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-1"
            >
              <a
                href="mailto:hello@temporium.xyz"
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Contact</span>
              </a>
              <a
                href="https://x.com/HelloTemporium"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative min-h-screen flex flex-col justify-center px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
        <div className="max-w-6xl mx-auto w-full">
          {/* Hero */}
          <div className="text-center mb-14 sm:mb-18">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Tagline */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-[13px] font-medium text-slate-600">
                  Tools for Tempo Blockchain
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] mb-6 leading-[1.05]">
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
                    Tempo
                  </span>
                  <span className="absolute -inset-1 bg-primary/10 blur-2xl rounded-full" />
                </span>
                <span className="text-slate-900"> at Your Fingertips</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Everything you need to interact with Tempo blockchain.
                <br className="hidden sm:block" />
                Manage your wallet or run your own infrastructure.
              </p>
            </motion.div>
          </div>

          {/* Product Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-5 sm:gap-6"
          >
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="h-full"
              >
                {product.available ? (
                  <a
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block h-full"
                  >
                    <div className="relative h-full rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 transition-all duration-300 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 overflow-hidden">
                      {/* Hover gradient overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: `radial-gradient(ellipse at 50% 0%, ${product.color}08 0%, transparent 70%)`,
                        }}
                      />

                      {/* Top accent line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left"
                        style={{ background: product.color }}
                      />

                      {/* Content */}
                      <div className="relative">
                        {/* Icon */}
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-105"
                          style={{ backgroundColor: `${product.color}12` }}
                        >
                          <product.icon
                            className="w-6 h-6 sm:w-7 sm:h-7"
                            style={{ color: product.color }}
                            strokeWidth={1.75}
                          />
                        </div>

                        {/* Tagline */}
                        <div
                          className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-widest mb-2"
                          style={{ color: product.color }}
                        >
                          {product.tagline}
                        </div>

                        {/* Title */}
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 tracking-tight">
                          {product.title}
                        </h3>

                        {/* Description */}
                        <p className="text-[14px] sm:text-[15px] text-slate-500 leading-relaxed mb-6">
                          {product.description}
                        </p>

                        {/* CTA Button */}
                        <div
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] sm:text-[14px] font-semibold text-white transition-all duration-300 group-hover:gap-3"
                          style={{ backgroundColor: product.color }}
                        >
                          <span>Launch App</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </a>
                ) : (
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="group block h-full w-full text-left cursor-pointer"
                  >
                    <div className="relative h-full rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 transition-all duration-300 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 overflow-hidden">
                      {/* Hover gradient overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: `radial-gradient(ellipse at 50% 0%, ${product.color}08 0%, transparent 70%)`,
                        }}
                      />

                      {/* Top accent line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left"
                        style={{ background: product.color }}
                      />

                      {/* Content */}
                      <div className="relative">
                        {/* Icon */}
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-105"
                          style={{ backgroundColor: `${product.color}12` }}
                        >
                          <product.icon
                            className="w-6 h-6 sm:w-7 sm:h-7"
                            style={{ color: product.color }}
                            strokeWidth={1.75}
                          />
                        </div>

                        {/* Tagline */}
                        <div
                          className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-widest mb-2"
                          style={{ color: product.color }}
                        >
                          {product.tagline}
                        </div>

                        {/* Title */}
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 tracking-tight">
                          {product.title}
                        </h3>

                        {/* Description */}
                        <p className="text-[14px] sm:text-[15px] text-slate-500 leading-relaxed mb-6">
                          {product.description}
                        </p>

                        {/* CTA Button */}
                        <div
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] sm:text-[14px] font-semibold text-white transition-all duration-300 group-hover:gap-3"
                          style={{ backgroundColor: product.color }}
                        >
                          <span>Launch App</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative px-4 sm:px-6 py-6 sm:py-8 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-[12px] sm:text-[13px]">Powered by</span>
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] sm:text-[13px] font-semibold text-slate-600 hover:text-primary transition-colors"
            >
              Tempo
            </a>
          </div>
          <div className="text-[12px] sm:text-[13px] text-slate-400">Fast, secure, and simple.</div>
        </div>
      </footer>

      {/* Coming Soon Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] z-50 px-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <h2 className="text-[15px] font-semibold text-gray-900">
                    {selectedProduct.title}
                  </h2>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${selectedProduct.color}15` }}
                    >
                      <selectedProduct.icon
                        className="h-6 w-6"
                        style={{ color: selectedProduct.color }}
                      />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900 mb-0.5">
                        Coming Soon
                      </div>
                      <p className="text-[12px] text-gray-500">{selectedProduct.description}</p>
                    </div>
                  </div>

                  <a
                    href="https://x.com/HelloTemporium"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-white text-[13px] font-semibold rounded-xl transition-opacity hover:opacity-90"
                    style={{ backgroundColor: selectedProduct.color }}
                  >
                    <Twitter className="h-4 w-4" />
                    Follow for Updates
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
