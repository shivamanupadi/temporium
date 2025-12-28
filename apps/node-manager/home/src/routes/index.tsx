import { createFileRoute } from '@tanstack/react-router';
import { type ReactElement, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  Server,
  Activity,
  Download,
  Shield,
  HardDrive,
  Cpu,
  MemoryStick,
  Terminal,
  Mail,
  Twitter,
  MousePointerClick,
  RefreshCw,
  BarChart3,
  Copy,
  Check,
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const [copied, setCopied] = useState(false);
  const installCommand =
    'curl -sSL https://cdn.temporium.xyz/node-manager/releases/install.sh | bash';

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textArea = document.createElement('textarea');
      textArea.value = installCommand;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const features = [
    {
      icon: MousePointerClick,
      title: 'One-Click Setup',
      description: 'Get running in minutes',
      color: '#0073e6',
    },
    {
      icon: Activity,
      title: 'Real-time Sync',
      description: 'Monitor block progress',
      color: '#10b981',
    },
    {
      icon: Download,
      title: 'Snapshot Sync',
      description: 'Fast initial sync',
      color: '#7c5cff',
    },
    {
      icon: RefreshCw,
      title: 'Auto Updates',
      description: 'Coming soon',
      color: '#f59e0b',
      comingSoon: true,
    },
    {
      icon: BarChart3,
      title: 'Metrics',
      description: 'Coming soon',
      color: '#ec4899',
      comingSoon: true,
    },
    {
      icon: Shield,
      title: 'Secure',
      description: 'Password protected',
      color: '#8b5cf6',
    },
  ];

  const requirements = [
    { icon: Cpu, label: 'CPU', value: '8+ cores' },
    { icon: MemoryStick, label: 'RAM', value: '16+ GB' },
    { icon: HardDrive, label: 'Storage', value: '250+ GB SSD' },
  ];

  return (
    <>
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" strokeWidth={2} />
            <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Temporium<span className="text-slate-400 font-normal hidden sm:inline"> | Node Manager</span>
            </span>
          </motion.div>
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 sm:gap-4"
          >
            <a
              href="https://x.com/HelloTemporium"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="mailto:hello@temporium.xyz"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">hello@temporium.xyz</span>
            </a>
          </motion.div>
        </div>
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-24 sm:pt-28 pb-8 sm:pb-12">
        {/* Content */}
        <div className="max-w-4xl w-full text-center">
          {/* Badge */}
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white backdrop-blur border border-border shadow-sm mb-4 sm:mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[12px] sm:text-[13px] font-medium text-foreground">Run Your Own Tempo RPC Node</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4"
          >
            <span className="text-primary">Node Manager</span> for
            <br />
            Tempo Blockchain
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-[14px] sm:text-[16px] text-muted-foreground mb-6 sm:mb-8 max-w-lg mx-auto px-2"
          >
            One-click deployment and real-time monitoring for your Tempo RPC node. Web dashboard and
            snapshot sync.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            <a
              href="#install"
              onClick={e => {
                e.preventDefault();
                document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Server className="h-4 w-4" />
              Install Now
              <ArrowRight className="h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>

          {/* Install Command */}
          <motion.div
            id="install"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mb-8 sm:mb-12 px-2"
          >
            <div className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border border-border max-w-full overflow-hidden">
              <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden xs:block" />
              <code className="text-[11px] sm:text-[13px] font-mono text-foreground break-all text-left">
                {installCommand}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-8 sm:mb-12"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="group relative bg-white backdrop-blur rounded-xl border border-border p-3 sm:p-4 cursor-default"
              >
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                  style={{
                    background: `radial-gradient(circle at center, ${feature.color}15 0%, transparent 70%)`,
                  }}
                />
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mx-auto mb-1.5 sm:mb-2"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: feature.color }} />
                </motion.div>
                <h3 className="text-[12px] sm:text-[13px] font-semibold mb-0.5">{feature.title}</h3>
                <p
                  className={`text-[10px] sm:text-[11px] ${feature.comingSoon ? 'text-amber-600' : 'text-muted-foreground'}`}
                >
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Requirements */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8 sm:mb-10"
          >
            <p className="text-[11px] sm:text-[12px] text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
              Minimum Requirements
            </p>
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-6 px-4 sm:px-6 py-3 bg-white rounded-xl border border-border">
              {requirements.map((req, index) => (
                <div key={req.label} className="flex items-center gap-2">
                  <req.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[12px] sm:text-[13px]">
                    <span className="text-muted-foreground">{req.label}:</span>{' '}
                    <span className="font-medium">{req.value}</span>
                  </span>
                  {index < requirements.length - 1 && <span className="ml-4 text-border hidden sm:inline">|</span>}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-[12px]">Powered by</span>
              <a
                href="https://tempo.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors"
              >
                Tempo
              </a>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
