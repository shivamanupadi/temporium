import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Code2,
  FileCode2,
  Terminal,
  Rocket,
  Blocks,
  Sparkles,
  FolderOpen,
  FolderPlus,
  Play,
  ArrowRight,
  Fingerprint,
  Wallet,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTempo } from '@/hooks/useTempo';
import { toast } from '@/lib/toast';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

// ============ Features Data ============
const features: { icon: LucideIcon; label: string; desc: string; color: string }[] = [
  { icon: FileCode2, label: 'Monaco Editor', desc: 'Full-featured code editor with IntelliSense, syntax highlighting, and auto-complete', color: '#E07A5F' },
  { icon: Terminal, label: 'In-Browser Compile', desc: 'Compile Solidity directly in your browser — no local tools or setup required', color: '#9B72CF' },
  { icon: Rocket, label: 'One-Click Deploy', desc: 'Deploy compiled contracts to Tempo with a single click using your connected wallet', color: '#5B9A6F' },
  { icon: Blocks, label: 'Contract Interaction', desc: 'Call read and write functions on deployed contracts with an auto-generated UI', color: '#6B8EAD' },
  { icon: Sparkles, label: 'Project Templates', desc: 'Start from ERC-20, ERC-721, Multi-Sig, or create from scratch — your choice', color: '#D4A574' },
  { icon: FolderOpen, label: 'Multi-File Projects', desc: 'Organize your contracts into folders with import resolution and file management', color: '#E07A5F' },
];

// ============ Steps Data ============
const steps: { icon: LucideIcon; label: string; desc: string; color: string }[] = [
  { icon: FolderPlus, label: 'Create', desc: 'Start a new project or choose a template', color: '#E07A5F' },
  { icon: Code2, label: 'Write', desc: 'Write Solidity with Monaco editor', color: '#9B72CF' },
  { icon: Play, label: 'Compile', desc: 'Compile in-browser with solc.js', color: '#5B9A6F' },
  { icon: Rocket, label: 'Deploy', desc: 'Deploy to Tempo in one click', color: '#E07A5F' },
];

// ============ Landing Page ============
function LandingPage(): ReactElement {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const { isConnected, isConnecting, signUp, signIn, connectInjected, hasInjectedWallet } = useTempo();
  const navigate = useNavigate();

  // If already connected, redirect to portal
  useEffect(() => {
    if (isConnected) {
      navigate({ to: '/portal' });
    }
  }, [isConnected, navigate]);

  const handlePasskeySignIn = async () => {
    try {
      await signIn();
      navigate({ to: '/portal' });
    } catch {
      toast.error('Sign in failed', { description: 'Could not authenticate with passkey' });
    }
  };

  const handleInjectedConnect = async () => {
    try {
      await connectInjected();
      navigate({ to: '/portal' });
    } catch {
      toast.error('Connection failed', { description: 'Could not connect browser wallet' });
    }
  };

  const handlePasskeySignUp = async () => {
    try {
      await signUp();
      navigate({ to: '/portal' });
    } catch {
      toast.error('Sign up failed', { description: 'Could not create passkey wallet' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ============ Nav Bar ============ */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-[#EDE9E3]"
      >
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#E07A5F]" />
            <span className="text-lg font-bold text-[#2D3436]">Temporium</span>
            <span className="text-lg text-[#6B6560] font-light">| Playground</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://docs.tempo.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#6B6560] hover:text-[#2D3436] transition-colors hidden sm:block"
            >
              Docs
            </a>
            <Button variant="ghost" size="sm" onClick={() => setShowSignIn(true)}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => setShowSignIn(true)}>
              Start Building
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* ============ Hero Section ============ */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-[500px] h-[500px] rounded-full bg-[#E07A5F]/5 blur-[120px]" />
          <div className="absolute bottom-20 right-[10%] w-[400px] h-[400px] rounded-full bg-[#9B72CF]/5 blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-16 items-center relative">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5B9A6F]/10 text-[#5B9A6F] text-sm font-medium mb-6">
              <div className="w-2 h-2 rounded-full bg-[#5B9A6F]" />
              Built for Tempo
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-[-0.04em] leading-[1.05] mb-6">
              Write. Compile. Deploy.
              <br />
              <span className="bg-gradient-to-r from-[#E07A5F] to-[#9B72CF] bg-clip-text text-transparent">
                Smart Contracts
              </span>
            </h1>

            <p className="text-lg text-[#6B6560] leading-relaxed max-w-xl mb-8">
              A browser-based Solidity IDE for Tempo blockchain. Monaco editor, in-browser
              compilation, one-click deployment — no setup required.
            </p>

            <div className="flex items-center gap-3">
              <Button size="xl" onClick={() => setShowSignIn(true)} className="shadow-lg shadow-[#E07A5F]/20">
                <Sparkles className="w-5 h-5" />
                Open Playground
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="xl" onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Browse Templates
              </Button>
            </div>
          </motion.div>

          {/* Right column — Editor Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{ perspective: 1000 }}
          >
            <div className="rounded-2xl border border-[#EDE9E3] bg-white shadow-2xl shadow-black/5 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#FAF8F5] border-b border-[#EDE9E3]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#E5484D]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#D4A574]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#5B9A6F]/60" />
                </div>
                <span className="text-xs text-[#6B6560] ml-2 font-mono">Contract.sol</span>
              </div>
              {/* Code */}
              <div className="p-5 font-mono text-[13px] leading-relaxed">
                <div>
                  <span className="text-[#6B6560]">{'// SPDX-License-Identifier: MIT'}</span>
                </div>
                <div>
                  <span className="text-[#E07A5F]">pragma</span>
                  <span className="text-[#2D3436]"> solidity </span>
                  <span className="text-[#5B9A6F]">^0.8.28</span>
                  <span className="text-[#2D3436]">;</span>
                </div>
                <div className="h-4" />
                <div>
                  <span className="text-[#E07A5F]">contract</span>
                  <span className="text-[#9B72CF]"> SimpleStorage</span>
                  <span className="text-[#2D3436]"> {'{'}</span>
                </div>
                <div className="pl-6">
                  <span className="text-[#9B72CF]">uint256</span>
                  <span className="text-[#E07A5F]"> private</span>
                  <span className="text-[#2D3436]"> _value;</span>
                </div>
                <div className="h-4" />
                <div className="pl-6">
                  <span className="text-[#E07A5F]">function</span>
                  <span className="text-[#2D3436] font-semibold"> store</span>
                  <span className="text-[#2D3436]">(</span>
                  <span className="text-[#9B72CF]">uint256</span>
                  <span className="text-[#2D3436]"> value) </span>
                  <span className="text-[#E07A5F]">public</span>
                  <span className="text-[#2D3436]"> {'{'}</span>
                </div>
                <div className="pl-12">
                  <span className="text-[#2D3436]">_value = value;</span>
                </div>
                <div className="pl-6">
                  <span className="text-[#2D3436]">{'}'}</span>
                </div>
                <div>
                  <span className="text-[#2D3436]">{'}'}</span>
                </div>
              </div>
              {/* Bottom bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#EDE9E3] bg-[#FAF8F5]">
                <span className="text-xs text-[#6B6560]">Solidity 0.8.28</span>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E07A5F] text-white text-xs font-medium"
                >
                  <Play className="w-3 h-3" />
                  Compile
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ Features Section ============ */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#E07A5F] mb-3 block">
              Features
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#2D3436] tracking-tight">
              Everything you need to ship smart contracts
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="group rounded-2xl border border-[#EDE9E3] bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${feature.color}12` }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3 className="text-base font-semibold text-[#2D3436] mb-1.5">{feature.label}</h3>
                <p className="text-sm text-[#6B6560] leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ How It Works ============ */}
      <section className="py-24 px-6 bg-[#F5F2ED]/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#E07A5F] mb-3 block">
              How it works
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#2D3436] tracking-tight">
              From idea to deployment in minutes
            </h2>
          </motion.div>

          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-start justify-between gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex-1 relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${step.color}12` }}
                  >
                    <step.icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <div className="text-xs font-bold text-[#B5B0AA] mb-1">STEP {i + 1}</div>
                  <h3 className="text-lg font-semibold text-[#2D3436] mb-1">{step.label}</h3>
                  <p className="text-sm text-[#6B6560]">{step.desc}</p>
                </div>
                {/* Connector */}
                {i < steps.length - 1 && (
                  <div className="absolute top-7 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-[2px] bg-[#EDE9E3]" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Mobile: vertical */}
          <div className="md:hidden space-y-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-start gap-4 relative"
              >
                {i < steps.length - 1 && (
                  <div className="absolute left-5 top-14 bottom-0 w-[2px] bg-[#EDE9E3]" />
                )}
                <div
                  className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${step.color}12` }}
                >
                  <step.icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#2D3436]">{step.label}</h3>
                  <p className="text-sm text-[#6B6560]">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA Section ============ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-[#2D3436] tracking-tight mb-4">
              Ready to build on Tempo?
            </h2>
            <p className="text-lg text-[#6B6560] mb-8">
              No downloads. No setup. Just start writing Solidity and deploy.
            </p>
            <Button size="xl" onClick={() => setShowSignIn(true)} className="shadow-lg shadow-[#E07A5F]/20">
              <Sparkles className="w-5 h-5" />
              Open Playground
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="border-t border-[#EDE9E3] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-[#6B6560]">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#E07A5F]" />
            <span>Temporium Playground</span>
          </div>
          <a href="https://docs.tempo.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#2D3436] transition-colors">
            Documentation
          </a>
        </div>
      </footer>

      {/* ============ Sign In Modal ============ */}
      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="max-w-sm p-6">
          <DialogTitle className="text-xl font-bold text-center mb-1">
            Welcome to Playground
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6B6560] text-center mb-6">
            Connect your wallet to start building
          </DialogDescription>

          <div className="space-y-3">
            {/* Passkey Sign In */}
            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E3] hover:border-[#9B72CF]/30 hover:bg-[#9B72CF]/5 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-[#9B72CF]" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-[#2D3436]">Sign in with Passkey</div>
                <div className="text-xs text-[#6B6560]">Use your biometrics</div>
              </div>
              {isConnecting && <Loader2 className="w-4 h-4 animate-spin text-[#6B6560]" />}
            </button>

            {/* Browser Wallet */}
            {hasInjectedWallet && (
              <button
                type="button"
                onClick={handleInjectedConnect}
                disabled={isConnecting}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E3] hover:border-[#E07A5F]/30 hover:bg-[#E07A5F]/5 transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#E07A5F]" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold text-[#2D3436]">Browser Wallet</div>
                  <div className="text-xs text-[#6B6560]">MetaMask, Rabby, etc.</div>
                </div>
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-[#EDE9E3]" />
              <span className="text-xs text-[#B5B0AA]">New here?</span>
              <div className="flex-1 h-px bg-[#EDE9E3]" />
            </div>

            {/* Create Wallet */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePasskeySignUp}
              disabled={isConnecting}
            >
              <Fingerprint className="w-4 h-4" />
              Create Passkey Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
