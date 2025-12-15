import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/portal/receive')({
  component: ReceivePage,
});

function ReceivePage(): ReactElement | null {
  const { address } = useTempo();
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

  if (!address) return null;

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied!');
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  return (
    <div className="max-w-md">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Receive</h1>
      </div>

      {/* QR Card */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-6"
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
            className="group inline-flex items-center gap-2 font-mono text-[13px] text-foreground bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-lg transition-colors"
          >
            <span className="break-all">{formatAddress(address, 8)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors" />
            )}
          </button>
        </div>

        {/* Full Address (expandable) */}
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
    </div>
  );
}
