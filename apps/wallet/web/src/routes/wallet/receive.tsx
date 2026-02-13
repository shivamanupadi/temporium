import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, Share2, Download, QrCode, Shield } from 'lucide-react';
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
        if ((err as Error).name !== 'AbortError') {
          await handleCopy();
        }
      }
    } else {
      await handleCopy();
    }
  }, [address, handleCopy]);

  const handleDownloadQR = useCallback((): void => {
    if (!qrRef.current || !address) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 512;
    const padding = 48;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      URL.revokeObjectURL(url);

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
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Receive</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Share your address or QR code to receive payments.
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* QR Code Section */}
        <div className="relative px-6 pt-8 pb-7">
          {/* Subtle gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#5B9A6F]/[0.03] to-transparent pointer-events-none" />

          {/* Decorative dot pattern */}
          <div className="absolute inset-0 opacity-[0.025] pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0.5px)`,
                backgroundSize: '20px 20px',
              }}
            />
          </div>

          {/* QR Code */}
          <motion.div
            className="relative flex justify-center"
            onHoverStart={() => setIsHoveringQR(true)}
            onHoverEnd={() => setIsHoveringQR(false)}
          >
            <motion.div
              ref={qrRef}
              animate={{ scale: isHoveringQR ? 1.03 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative"
            >
              {/* Glow effect */}
              <motion.div
                animate={{ opacity: isHoveringQR ? 0.8 : 0.4 }}
                transition={{ duration: 0.3 }}
                className="absolute -inset-4 bg-gradient-to-br from-[#E07A5F]/15 via-[#9B72CF]/15 to-[#5B9A6F]/15 rounded-3xl blur-2xl"
              />

              {/* QR Card */}
              <div className="relative p-5 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.1)]">
                <QRCodeSVG
                  value={address!}
                  size={180}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#2D3436"
                />

                {/* Center logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-border/20 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Download overlay on hover */}
            <AnimatePresence>
              {isHoveringQR && (
                <motion.button
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleDownloadQR}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2D3436] text-white text-[11px] font-semibold rounded-full shadow-lg hover:bg-[#3D4446] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Save QR
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Scan prompt */}
          <p className="text-[11px] text-muted-foreground/50 text-center mt-6 font-medium uppercase tracking-widest">
            Scan to send payment
          </p>
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border/40" />

        {/* Address Section */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Wallet Address
            </span>
            <div className="flex items-center gap-1 text-[10px] text-[#5B9A6F] font-medium">
              <Shield className="w-3 h-3" />
              Your address
            </div>
          </div>

          {/* Clickable address card */}
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.98 }}
            className="w-full group relative bg-[#FDFBF8] hover:bg-[#F8F5F0] rounded-xl px-4 py-3.5 transition-colors border border-border/20 hover:border-border/40 text-left"
          >
            <p className="font-mono text-[12.5px] text-[#4D5456] break-all leading-relaxed pr-10">
              {address}
            </p>

            {/* Copy badge */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-8 h-8 bg-[#5B9A6F]/12 rounded-lg flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-[#5B9A6F]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-8 h-8 bg-white shadow-sm border border-border/20 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:shadow-md transition-all"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-white transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border/40" />

        {/* Action Buttons */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-2.5">
            <Button
              variant="outline"
              className="h-[52px] flex-col gap-1 py-2 rounded-xl border-border/40 hover:border-primary/30 hover:bg-primary/[0.04] transition-all group"
              onClick={handleCopy}
            >
              <div className="w-7 h-7 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#5B9A6F]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <span className="text-[11px] font-medium">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>

            <Button
              variant="outline"
              className="h-[52px] flex-col gap-1 py-2 rounded-xl border-border/40 hover:border-primary/30 hover:bg-primary/[0.04] transition-all group"
              onClick={handleShare}
            >
              <div className="w-7 h-7 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[11px] font-medium">Share</span>
            </Button>

            <Button
              variant="outline"
              className="h-[52px] flex-col gap-1 py-2 rounded-xl border-border/40 hover:border-[#5B9A6F]/30 hover:bg-[#5B9A6F]/[0.04] transition-all group"
              onClick={() => window.open(getExplorerAddressUrl(address!), '_blank')}
            >
              <div className="w-7 h-7 rounded-lg bg-muted/60 group-hover:bg-[#5B9A6F]/10 flex items-center justify-center transition-colors">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#5B9A6F] transition-colors" />
              </div>
              <span className="text-[11px] font-medium">Explorer</span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
