import { type ReactElement, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { copyToClipboard } from '@/lib/utils';
import { TIMING } from '@/lib/constants';

interface ReceiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string | undefined;
}

export function ReceiveModal({ open, onOpenChange, address }: ReceiveModalProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] p-0 gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Wallet Address QR Code</DialogTitle>
        <DialogDescription className="sr-only">
          Scan this QR code to get the wallet address
        </DialogDescription>

        <div className="px-6 pt-7 pb-5">
          <h3 className="text-[17px] font-semibold text-[#2D3436] mb-1">Your Address</h3>
          <p className="text-[13px] text-[#8A8580]">Scan to receive tokens on Tempo</p>
        </div>

        <div className="px-6 pb-6 flex flex-col items-center">
          <div className="p-4 rounded-2xl border border-[#EDE9E3] bg-white">
            {address && (
              <QRCodeSVG
                value={address}
                size={200}
                level="M"
                bgColor="transparent"
                fgColor="#2D3436"
              />
            )}
          </div>
          <p className="mt-4 text-[12px] font-mono text-[#6B6560] break-all text-center leading-relaxed px-2">
            {address}
          </p>
        </div>

        <div className="border-t border-[#EDE9E3]/60 px-6 py-4 flex gap-2.5">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-medium border transition-all duration-200 ${
              copied
                ? 'text-[#6B8F71] border-[#6B8F71]/20 bg-[#6B8F71]/5'
                : 'text-[#4D5456] border-[#EDE9E3] hover:bg-[#F5F2ED]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#9B9590]" />
                Copy Address
              </>
            )}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-xl text-[13px] font-semibold text-white bg-[#6B8F71] hover:bg-[#5A7D60] transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
