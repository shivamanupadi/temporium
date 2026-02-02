import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, Share2, Download, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { copyToClipboard } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/wallet/receive')({
  component: ReceivePage,
});

function ReceivePage(): ReactElement {
  const { address } = useTempo();
  const [copied, setCopied] = useState(false);
  const [isHoveringQR, setIsHoveringQR] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied to clipboard');
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  }, [address]);

  const handleShare = useCallback(async (): Promise<void> => {
    if (!address) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Temporium Wallet Address',
          text: `Send payments to my wallet:\n${address}`,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        if ((err as Error).name !== 'AbortError') {
          await handleCopy();
        }
      }
    } else {
      // Fallback for browsers without share API
      await handleCopy();
    }
  }, [address, handleCopy]);

  const handleDownloadQR = useCallback((): void => {
    if (!qrRef.current || !address) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 512;
    const padding = 48;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      URL.revokeObjectURL(url);

      // Download
      const link = document.createElement('a');
      link.download = `temporium-wallet-${address.slice(0, 8)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('QR code downloaded');
    };
    img.src = url;
  }, [address]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Receive</h1>
        <p className="text-sm text-muted-foreground mt-1">Share your address to receive payments</p>
      </div>

      {/* QR Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-border/50 rounded-2xl overflow-hidden shadow-sm"
      >
        {/* QR Code Section */}
        <div className="relative bg-gradient-to-b from-slate-50/80 to-white px-6 pt-8 pb-6">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
              }}
            />
          </div>

          {/* QR Code Container */}
          <motion.div
            className="relative flex justify-center"
            onHoverStart={() => setIsHoveringQR(true)}
            onHoverEnd={() => setIsHoveringQR(false)}
          >
            <motion.div
              ref={qrRef}
              animate={{ scale: isHoveringQR ? 1.02 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative"
            >
              {/* Gradient border effect */}
              <div className="absolute -inset-3 bg-gradient-to-br from-primary/20 via-violet-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-60" />

              {/* QR Code Card */}
              <div className="relative p-5 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_16px_-4px_rgba(0,0,0,0.12)]">
                <QRCodeSVG
                  value={address!}
                  size={180}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                />

                {/* Center logo overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Download button overlay */}
            <AnimatePresence>
              {isHoveringQR && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleDownloadQR}
                  className="absolute -bottom-2 right-1/2 translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-full shadow-lg hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Save QR
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Address Section */}
        <div className="px-6 py-5 border-t border-border/50">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3 text-center">
            Wallet Address
          </p>

          {/* Clickable address */}
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.98 }}
            className="w-full group relative bg-slate-50 hover:bg-slate-100 rounded-xl p-4 transition-colors"
          >
            <p className="font-mono text-[13px] text-slate-700 text-center break-all leading-relaxed pr-8">
              {address}
            </p>

            {/* Copy indicator */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-8 h-8 bg-white shadow-sm rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-11 flex-col gap-0.5 py-2" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-slate-500" />
              )}
              <span className="text-[11px] font-medium">{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button variant="outline" className="h-11 flex-col gap-0.5 py-2" onClick={handleShare}>
              <Share2 className="h-4 w-4 text-slate-500" />
              <span className="text-[11px] font-medium">Share</span>
            </Button>

            <Button
              variant="outline"
              className="h-11 flex-col gap-0.5 py-2"
              onClick={() => window.open(getExplorerAddressUrl(address!), '_blank')}
            >
              <ExternalLink className="h-4 w-4 text-slate-500" />
              <span className="text-[11px] font-medium">Explorer</span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
