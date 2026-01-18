import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/receive')({
  component: ReceivePage,
});

function ReceivePage(): ReactElement | null {
  const { address, isConnected } = useTempo();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your address</p>
          <Link to="/">
            <Button>Go to Wallet</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied!');
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Receive</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border/50 rounded-2xl p-6 shadow-sm"
        >
          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_8px_-2px_rgba(0,0,0,0.08)]">
              <QRCodeSVG
                value={address}
                size={180}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#0a0a0a"
              />
            </div>
          </div>

          {/* Address */}
          <div className="text-center mb-6">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Your Address
            </p>
            <button
              onClick={handleCopy}
              className="group inline-flex items-center gap-2 font-mono text-[13px] text-foreground bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="break-all">{formatAddress(address, 8)}</span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors" />
              )}
            </button>
          </div>

          {/* Full Address */}
          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <p className="font-mono text-[11px] text-gray-500 text-center break-all leading-relaxed">
              {address}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-10" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => window.open(getExplorerAddressUrl(address), '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Explorer
            </Button>
          </div>
        </motion.div>

        {/* Info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[12px] text-muted-foreground text-center mt-4"
        >
          Share this address or QR code to receive payments
        </motion.p>
      </main>
    </div>
  );
}
