import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Server, ArrowRight, Twitter, Mail, Code2, X, ExternalLink } from 'lucide-react';

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
    color: '#E07A5F',
    lightColor: '#FFF5F0',
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
    color: '#9B72CF',
    lightColor: '#F8F4FF',
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
    color: '#5B9A6F',
    lightColor: '#F0FDF4',
    href: '#',
    available: false,
  },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 } as const,
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

function ProductCard({
  product,
  onSelect,
}: {
  product: (typeof products)[number];
  onSelect: (p: (typeof products)[number]) => void;
}): ReactElement {
  const inner = (
    <div className="group/card relative h-full">
      {/* Colored left accent bar */}
      <div
        className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full transition-all duration-500 group-hover/card:top-3 group-hover/card:bottom-3"
        style={{ backgroundColor: product.color }}
      />

      <div className="relative h-full rounded-2xl bg-white border border-[#EDE9E3] pl-7 pr-6 py-7 sm:pl-8 sm:pr-7 sm:py-8 transition-all duration-300 group-hover/card:border-[#DDD8D1] group-hover/card:shadow-lg overflow-hidden">
        {/* Hover glow */}
        <div
          className="absolute -top-20 -right-20 w-52 h-52 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 blur-[80px] pointer-events-none"
          style={{ background: product.color }}
        />

        <div className="relative flex flex-col h-full">
          {/* Top row: icon + status */}
          <div className="flex items-start justify-between mb-6">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover/card:scale-110 group-hover/card:rotate-[-3deg]"
              style={{ backgroundColor: product.lightColor }}
            >
              <product.icon
                className="w-5 h-5"
                style={{ color: product.color }}
                strokeWidth={1.8}
              />
            </div>
            {product.available ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5B9A6F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F] animate-pulse" />
                Live
              </span>
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9B9590]">
                Soon
              </span>
            )}
          </div>

          {/* Tagline */}
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1.5"
            style={{ color: product.color }}
          >
            {product.tagline}
          </p>

          {/* Title */}
          <h3 className="text-[22px] sm:text-2xl font-bold text-[#2D3436] mb-2.5 tracking-[-0.02em]">
            {product.title}
          </h3>

          {/* Description */}
          <p className="text-[13.5px] leading-[1.65] text-[#6B6560] mb-8 flex-1">
            {product.description}
          </p>

          {/* CTA */}
          <div className="flex items-center gap-2 group-hover/card:gap-2.5 transition-all duration-300">
            <span className="text-[13px] font-semibold" style={{ color: product.color }}>
              {product.available ? 'Launch App' : 'Learn More'}
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 transition-transform duration-300 group-hover/card:translate-x-1"
              style={{ color: product.color }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (product.available) {
    return (
      <motion.a
        href={product.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
        variants={fadeUp}
        whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={() => onSelect(product)}
      className="block h-full w-full text-left cursor-pointer"
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
    >
      {inner}
    </motion.button>
  );
}

function HomePage(): ReactElement {
  const [selectedProduct, setSelectedProduct] = useState<(typeof products)[number] | null>(null);

  return (
    <div className="min-h-screen bg-[#FDFBF8] text-[#2D3436] overflow-x-hidden">
      {/* Atmospheric background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#FDFBF8]" />
        {/* Warm mesh gradient - top right coral whisper */}
        <div
          className="absolute -top-32 right-[10%] w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.045]"
          style={{ background: '#E07A5F' }}
        />
        {/* Center-left lavender drift */}
        <div
          className="absolute top-[40%] -left-[5%] w-[500px] h-[500px] rounded-full blur-[160px] opacity-[0.04]"
          style={{ background: '#9B72CF' }}
        />
        {/* Bottom sage glow */}
        <div
          className="absolute -bottom-20 right-[20%] w-[450px] h-[450px] rounded-full blur-[150px] opacity-[0.035]"
          style={{ background: '#5B9A6F' }}
        />
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />
      </div>

      {/* ── Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 group">
              <img
                src="/logo_tricolor.png"
                alt="Temporium"
                className="w-8 h-8 rounded-[10px] shadow-sm transition-transform duration-300 group-hover:scale-105"
              />
              <span className="text-[15px] font-bold tracking-[-0.02em] text-[#2D3436]">
                Temporium
              </span>
            </a>

            {/* Right nav */}
            <div className="flex items-center gap-0.5">
              <a
                href="mailto:hello@temporium.xyz"
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] rounded-lg transition-colors"
              >
                <Mail className="w-[15px] h-[15px]" />
                <span className="hidden sm:inline">Contact</span>
              </a>
              <a
                href="https://x.com/HelloTemporium"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 text-[#6B6560] hover:text-[#2D3436] rounded-lg transition-colors"
              >
                <Twitter className="w-[15px] h-[15px]" />
              </a>
              <div className="w-px h-5 bg-[#EDE9E3] mx-2 hidden sm:block" />
              <a
                href={GATEWAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-[#E07A5F] rounded-xl hover:bg-[#d06a50] transition-colors"
              >
                Open App
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <main className="relative pt-32 sm:pt-40 pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-3xl mx-auto text-center mb-20 sm:mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              {/* Status badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-[7px] rounded-full border border-[#EDE9E3] bg-white/70 backdrop-blur-sm mb-8">
                <span className="relative flex h-[7px] w-[7px]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E07A5F] opacity-60" />
                  <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-[#E07A5F]" />
                </span>
                <span className="text-[12px] font-semibold tracking-wide uppercase text-[#6B6560]">
                  Tools for Tempo Blockchain
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease }}
              className="text-[40px] sm:text-[56px] md:text-[68px] lg:text-[80px] font-bold tracking-[-0.04em] leading-[1.05] mb-6"
            >
              <span className="relative inline-block">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #E07A5F 0%, #9B72CF 50%, #5B9A6F 100%)',
                  }}
                >
                  Tempo
                </span>
              </span>
              <span className="text-[#2D3436]"> at Your </span>
              <br className="hidden md:block" />
              <span className="text-[#2D3436]">Fingertips</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className="text-[16px] sm:text-[18px] leading-[1.7] text-[#6B6560] max-w-lg mx-auto"
            >
              Everything you need to interact with Tempo blockchain.
              <br className="hidden sm:block" />
              Manage your wallet or run your own infrastructure.
            </motion.p>

            {/* Color accent dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex items-center justify-center gap-2 mt-8"
            >
              {['#E07A5F', '#9B72CF', '#5B9A6F'].map(c => (
                <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </motion.div>
          </div>

          {/* ── Product cards ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-3 gap-5 sm:gap-6"
          >
            {products.map(product => (
              <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
            ))}
          </motion.div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative border-t border-[#EDE9E3]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] sm:text-[13px] text-[#9B9590]">
            <span>Powered by</span>
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#6B6560] hover:text-[#9B72CF] transition-colors"
            >
              Tempo
            </a>
          </div>
          <span className="text-[12px] sm:text-[13px] text-[#9B9590]">
            Fast, secure, and simple.
          </span>
        </div>
      </footer>

      {/* ── Coming Soon Modal ── */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-[#2D3436]/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] z-50 px-5"
            >
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
                {/* Colored top bar */}
                <div
                  className="h-1"
                  style={{
                    background: `linear-gradient(90deg, ${selectedProduct.color}, ${selectedProduct.color}88)`,
                  }}
                />

                <div className="px-6 pt-5 pb-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: selectedProduct.lightColor }}
                      >
                        <selectedProduct.icon
                          className="w-5 h-5"
                          style={{ color: selectedProduct.color }}
                          strokeWidth={1.8}
                        />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-bold text-[#2D3436]">
                          {selectedProduct.title}
                        </h2>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9B9590]">
                          Coming Soon
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="p-1.5 -mr-1 -mt-0.5 rounded-lg hover:bg-[#F5F2ED] transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4 text-[#9B9590]" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] leading-[1.65] text-[#6B6560] mb-5 pl-[52px]">
                    {selectedProduct.description}
                  </p>

                  {/* CTA */}
                  <a
                    href="https://x.com/HelloTemporium"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 text-white text-[13px] font-semibold rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
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
