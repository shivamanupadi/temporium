import { createFileRoute } from '@tanstack/react-router';
import { type ReactElement, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const [copied, setCopied] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
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
      color: '#7c5cff',
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2.5"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
              <Zap className="relative w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={2.5} />
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Temporium
              <span className="text-slate-400 font-normal hidden sm:inline"> | Node Manager</span>
            </span>
          </motion.div>
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-0.5 sm:gap-1"
          >
            <a
              href="mailto:hello@temporium.xyz"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contact</span>
            </a>
            <a
              href="https://x.com/HelloTemporium"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </div>

      <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 pt-20 pb-12">
        {/* Background */}
        <div className="fixed inset-0 -z-10 bg-[#fafafa]" />

        {/* 2-Column Layout */}
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-[12px] sm:text-[13px] font-medium text-slate-600">
                  Run Your Own Tempo RPC Node
                </span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] mb-5 sm:mb-6 leading-[1.1]">
                <span className="relative">
                  <span className="relative z-10 text-primary">Node Manager</span>
                  <span className="absolute -inset-1 bg-primary/10 blur-2xl rounded-full" />
                </span>
                <span className="text-slate-900"> for</span>
                <br />
                <span className="text-slate-900">Tempo Blockchain</span>
              </h1>

              {/* Subtitle */}
              <p className="text-[15px] sm:text-[17px] text-slate-500 mb-8 leading-relaxed max-w-lg">
                One-click deployment and real-time monitoring for your Tempo RPC node. Web dashboard
                with <span className="text-slate-700 font-medium">snapshot sync</span>.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <motion.button
                  onClick={() => setShowInstallModal(true)}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer outline-none bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6 group relative px-7 py-6 text-[15px] font-semibold"
                >
                  <Server className="h-4 w-4 mr-2 opacity-80" />
                  Install Now
                  <ArrowRight className="h-4 w-4 ml-2 opacity-60 group-hover:translate-x-1 transition-transform duration-300" />
                </motion.button>
              </div>

              {/* Requirements */}
              <div className="mt-8 mb-8">
                <p className="text-[11px] sm:text-[12px] text-slate-400 uppercase tracking-wider mb-3">
                  Minimum Requirements
                </p>
                <div className="inline-flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-4 py-3 bg-white rounded-xl border border-slate-200">
                  {requirements.map((req, index) => (
                    <div key={req.label} className="flex items-center gap-2">
                      <req.icon className="h-4 w-4 text-slate-400" />
                      <span className="text-[12px] sm:text-[13px]">
                        <span className="text-slate-400">{req.label}:</span>{' '}
                        <span className="font-medium text-slate-700">{req.value}</span>
                      </span>
                      {index < requirements.length - 1 && (
                        <span className="ml-3 text-slate-200 hidden sm:inline">|</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Powered by */}
              <div className="flex items-center gap-3 text-slate-400">
                <span className="text-[12px] sm:text-[13px]">Powered by</span>
                <a
                  href="https://tempo.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] sm:text-[13px] font-bold text-slate-600 hover:text-primary transition-colors duration-300"
                >
                  Tempo
                </a>
              </div>
            </motion.div>

            {/* Right Column - Features Grid */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                    whileHover={{
                      y: -3,
                      transition: { duration: 0.2 },
                    }}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 cursor-default hover:border-slate-300 hover:shadow-md transition-all duration-300"
                  >
                    {/* Hover gradient overlay */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${feature.color}08 0%, transparent 70%)`,
                      }}
                    />

                    {/* Top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left"
                      style={{ background: feature.color }}
                    />

                    {/* Content */}
                    <div className="relative flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: `${feature.color}12` }}
                      >
                        <feature.icon
                          className="h-4.5 w-4.5"
                          style={{ color: feature.color }}
                          strokeWidth={1.75}
                        />
                      </div>

                      {/* Text */}
                      <div className="min-w-0">
                        <h3 className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-0.5 truncate">
                          {feature.title}
                        </h3>
                        <p
                          className={`text-[11px] sm:text-[12px] leading-snug ${feature.comingSoon ? 'text-amber-600' : 'text-slate-500'}`}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Install Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallModal(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[480px] z-50 px-4"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Install Node Manager</h2>
                    <button
                      onClick={() => setShowInstallModal(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[13px] text-gray-500">
                    Follow these steps to set up your Tempo RPC node
                  </p>
                </div>

                {/* Steps */}
                <div className="px-6 pb-4 space-y-3">
                  {/* Step 1 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[12px] font-semibold text-primary">1</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 mb-1">
                        Prepare your server
                      </p>
                      <p className="text-[12px] text-gray-500">
                        Linux (Ubuntu, Debian, CentOS, Arch, Alpine) or macOS with 8+ CPU cores,
                        16GB+ RAM, 250GB+ SSD
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[12px] font-semibold text-primary">2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 mb-1">
                        Run the install script
                      </p>
                      <p className="text-[12px] text-gray-500 mb-2">
                        SSH into your server and run this command:
                      </p>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                        <Terminal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <code className="text-[11px] font-mono text-gray-700 break-all flex-1">
                          {installCommand}
                        </code>
                        <button
                          onClick={handleCopy}
                          className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[12px] font-semibold text-primary">3</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 mb-1">
                        Follow the prompts
                      </p>
                      <p className="text-[12px] text-gray-500">
                        Set your dashboard password and choose sync method (snapshot recommended)
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[12px] font-semibold text-primary">4</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 mb-1">
                        Access your dashboard
                      </p>
                      <p className="text-[12px] text-gray-500">
                        Open{' '}
                        <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">
                          http://your-server-ip:3003
                        </code>{' '}
                        to monitor your node
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-2">
                  <motion.button
                    onClick={handleCopy}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-300 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Install Command
                      </>
                    )}
                  </motion.button>
                  <p className="text-[11px] text-gray-400 text-center mt-3">
                    Need help? Contact us at hello@temporium.xyz
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
