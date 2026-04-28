import { type ReactElement, useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import { toast } from '@/lib/toast';
import { getVirtualAddress } from '@/lib/virtual-addresses-api';
import { useVirtualAddresses } from '@/hooks/useVirtualAddresses';

export const Route = createFileRoute('/portal/virtual-addresses/$id')({
  component: VirtualAddressDetailPage,
});

function VirtualAddressDetailPage(): ReactElement {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { remove } = useVirtualAddresses();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['virtualAddress', id],
    queryFn: () => getVirtualAddress(id),
  });

  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async (): Promise<void> => {
    if (!data) return;
    const ok = await copyToClipboard(data.address);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
  };

  const handleDelete = async (): Promise<void> => {
    if (!data) return;
    setIsDeleting(true);
    try {
      await remove(data.id);
      toast.success('Address removed');
      navigate({ to: '/portal/virtual-addresses' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error('Could not delete', { description: msg });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mb-3" />
        <p className="text-[14px] text-[#9B9590]">Loading...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-sm rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-10 text-center">
        <p className="text-[14px] text-[#6B6560]">Virtual address not found.</p>
        <Link
          to="/portal/virtual-addresses"
          className="inline-block mt-4 text-[13px] font-medium text-[#E07A5F] hover:underline"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const explorerUrl = getExplorerAddressUrl(data.address);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-sm"
    >
      <Link
        to="/portal/virtual-addresses"
        className="inline-flex items-center gap-1 text-[12px] text-[#9B9590] hover:text-[#6B6560] mb-4 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Virtual addresses
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">{data.label}</h1>
        <p className="mt-1.5 text-[13px] text-[#6B6560]">Forwards to your wallet</p>
      </div>

      <div className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden">
        <div className="flex justify-center pt-8 pb-6 px-6">
          <div className="p-4 rounded-2xl bg-white border border-[#EDE9E3]">
            <QRCodeSVG
              value={data.address}
              size={180}
              level="M"
              bgColor="transparent"
              fgColor="#2D3436"
            />
          </div>
        </div>

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
                {data.address}
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

      <button
        onClick={() => setDeleteOpen(true)}
        className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#9B9590] hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Remove this address
      </button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm p-6 rounded-2xl text-center" hideClose>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
            Remove this virtual address?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed mb-5">
            We&apos;ll delete the label and contact mapping. The address itself keeps forwarding
            on-chain.
          </DialogDescription>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Keep
            </Button>
            <Button
              onClick={handleDelete}
              isLoading={isDeleting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
            >
              {!isDeleting && 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
