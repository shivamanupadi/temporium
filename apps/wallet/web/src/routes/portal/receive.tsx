import { type ReactElement, useState, useRef, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { copyToClipboard } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

export const Route = createFileRoute('/portal/receive')({
  component: ReceivePage,
});

function ReceivePage(): ReactElement | null {
  const { address } = useTempo();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!address) return null;

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  const explorerUrl = getExplorerAddressUrl(address);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-sm"
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Receive</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Scan QR or copy address to receive tokens.
        </p>
      </div>

      {/* QR + Address Card */}
      <div className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden">
        {/* QR Code */}
        <div className="flex justify-center pt-8 pb-6 px-6">
          <div className="p-4 rounded-2xl bg-white border border-[#EDE9E3]">
            <QRCodeSVG
              value={address}
              size={180}
              level="M"
              bgColor="transparent"
              fgColor="#2D3436"
            />
          </div>
        </div>

        {/* Address */}
        <div className="px-6 pb-6">
          <button onClick={handleCopy} className="w-full group">
            <div
              className={`rounded-xl px-4 py-3 transition-all duration-200 ${
                copied
                  ? 'bg-[#6B8F71]/5 border border-[#6B8F71]/15'
                  : 'bg-[#F5F2ED]/60 border border-transparent hover:bg-[#F5F2ED]'
              }`}
            >
              <p className="font-mono text-[11px] text-[#6B6560] break-all leading-relaxed text-center">
                {address}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#6B8F71]" />
                    <span className="text-[11px] font-medium text-[#6B8F71]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#B5B0AA] group-hover:text-[#9B9590] transition-colors" />
                    <span className="text-[11px] font-medium text-[#B5B0AA] group-hover:text-[#9B9590] transition-colors">
                      Tap to copy
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="border-t border-[#F5F2ED] flex">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium transition-colors border-r border-[#F5F2ED] ${
              copied ? 'text-[#6B8F71]' : 'text-[#6B6560] hover:bg-[#FDFBF8]'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#9B9590]" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium text-[#6B6560] hover:bg-[#FDFBF8] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#9B9590]" />
            Explorer
          </a>
        </div>
      </div>
    </motion.div>
  );
}
