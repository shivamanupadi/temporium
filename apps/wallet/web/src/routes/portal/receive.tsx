import { type ReactElement, useState, useRef, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress, copyToClipboard } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/portal/receive')({
  component: ReceivePage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

function ReceivePage(): ReactElement | null {
  const { address } = useTempo();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      toast.success('Address copied to clipboard');
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    } else {
      toast.error('Failed to copy address');
    }
  };

  const explorerUrl = getExplorerAddressUrl(address);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Receive</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Share your address or QR code to receive payments.
        </p>
      </motion.div>

      {/* QR Card */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-[#EDE9E3] bg-white p-6"
      >
        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-5 rounded-2xl border border-[#EDE9E3] bg-[#FDFBF8]">
            <QRCodeSVG
              value={address}
              size={192}
              level="H"
              includeMargin={false}
              bgColor="#FDFBF8"
              fgColor="#2D3436"
            />
          </div>
        </div>

        {/* Address Label */}
        <div className="text-center mb-4">
          <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
            Your Address
          </p>
          <button
            onClick={handleCopy}
            className="group inline-flex items-center gap-2 font-mono text-[13px] text-[#2D3436] bg-[#F5F2ED] hover:bg-[#EDE9E3] px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <span className="break-all">{formatAddress(address, 8)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#5B9A6F] flex-shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#9B9590] group-hover:text-[#6B6560] flex-shrink-0 transition-colors" />
            )}
          </button>
        </div>

        {/* Full Address */}
        <div className="rounded-xl bg-[#FDFBF8] border border-[#EDE9E3] p-3.5 mb-5">
          <p className="font-mono text-[11px] text-[#6B6560] text-center break-all leading-relaxed select-all">
            {address}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            className="h-10 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#2D3436] hover:bg-[#F5F2ED]"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#5B9A6F] mr-1.5" />
            ) : (
              <Copy className="h-4 w-4 mr-1.5" />
            )}
            {copied ? 'Copied' : 'Copy Address'}
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#2D3436] hover:bg-[#F5F2ED]"
            onClick={() => window.open(explorerUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Explorer
          </Button>
        </div>
      </motion.div>

      {/* Info Note */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3 rounded-2xl border border-dashed border-[#EDE9E3] bg-[#FDFBF8] px-5 py-4"
      >
        <div className="w-9 h-9 rounded-xl bg-[#5B9A6F]/10 flex items-center justify-center shrink-0">
          <QrCode className="w-4.5 h-4.5 text-[#5B9A6F]" />
        </div>
        <p className="text-[12px] text-[#6B6560] leading-relaxed">
          Share this QR code or address with anyone to receive tokens on the Tempo network.
        </p>
      </motion.div>
    </motion.div>
  );
}
