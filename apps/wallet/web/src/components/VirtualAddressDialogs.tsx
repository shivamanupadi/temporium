import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';
import { VirtualAddress as VirtualAddressUtil } from 'viem/tempo';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVirtualAddresses, useVirtualMaster } from '@/hooks/useVirtualAddresses';
import { toast } from '@/lib/toast';

// =============================================================================
// CreateVirtualAddressDialog
// =============================================================================

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVirtualAddressDialog({ open, onOpenChange }: CreateProps): ReactElement {
  const navigate = useNavigate();
  const { create } = useVirtualAddresses();
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setLabel('');
      setSubmitting(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      const created = await create({ label: label.trim() });
      toast.success('Address created');
      onOpenChange(false);
      navigate({ to: '/portal/virtual-addresses/$id', params: { id: created.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create address';
      toast.error('Could not create address', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 rounded-2xl">
        <form onSubmit={submit}>
          <div className="p-6 pb-0 text-center">
            <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
              New virtual address
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed">
              Give this address a label so you remember what it&apos;s for. Deposits forward to
              your main wallet automatically.
            </DialogDescription>
          </div>

          <div className="p-6">
            <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1.5">
              Label
            </label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Alice (Q2 invoice)"
              maxLength={64}
              autoFocus
              className="h-10 px-3.5 bg-white text-[14px]"
            />
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!label.trim() || submitting}
              isLoading={submitting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
            >
              {!submitting && 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// ImportVirtualAddressDialog
// =============================================================================

interface ImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportValidation =
  | { state: 'empty' }
  | { state: 'invalid'; message: string }
  | { state: 'foreign' }
  | { state: 'valid'; masterId: string };

export function ImportVirtualAddressDialog({ open, onOpenChange }: ImportProps): ReactElement {
  const navigate = useNavigate();
  const { master } = useVirtualMaster();
  const { importAddress } = useVirtualAddresses();
  const [pasted, setPasted] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPasted('');
      setLabel('');
      setSubmitting(false);
    }
  }, [open]);

  const validation: ImportValidation = useMemo(() => {
    const trimmed = pasted.trim();
    if (!trimmed) return { state: 'empty' };
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return { state: 'invalid', message: 'Not a 20-byte address' };
    }
    if (!VirtualAddressUtil.isVirtual(trimmed)) {
      return { state: 'invalid', message: 'Not a TIP-1022 virtual address' };
    }
    const parsed = VirtualAddressUtil.parse(trimmed);
    const matches = !!master && parsed.masterId.toLowerCase() === master.masterId.toLowerCase();
    if (!matches) return { state: 'foreign' };
    return { state: 'valid', masterId: parsed.masterId };
  }, [pasted, master]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (validation.state !== 'valid' || !label.trim()) return;
    setSubmitting(true);
    try {
      const imported = await importAddress({
        address: pasted.trim() as `0x${string}`,
        label: label.trim(),
      });
      toast.success('Address imported');
      onOpenChange(false);
      navigate({ to: '/portal/virtual-addresses/$id', params: { id: imported.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import';
      toast.error('Could not import', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 rounded-2xl">
        <form onSubmit={submit}>
          <div className="p-6 pb-0 text-center">
            <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
              Import existing address
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed">
              Paste a virtual address you generated elsewhere to record it here with a label.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1.5">
                Virtual address
              </label>
              <Input
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                placeholder="0x..."
                autoFocus
                spellCheck={false}
                className="h-10 px-3.5 bg-white text-[13px] font-mono"
              />
              {validation.state === 'invalid' && (
                <p className="mt-1.5 text-[12px] text-red-500 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {validation.message}
                </p>
              )}
              {validation.state === 'foreign' && (
                <p className="mt-1.5 text-[12px] text-red-500 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  This address doesn&apos;t belong to your master ID
                </p>
              )}
              {validation.state === 'valid' && (
                <p className="mt-1.5 text-[12px] text-[#6B8F71] flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Verified — masterId {validation.masterId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1.5">
                Label
              </label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Bob (legacy CLI)"
                maxLength={64}
                className="h-10 px-3.5 bg-white text-[14px]"
              />
            </div>
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={validation.state !== 'valid' || !label.trim() || submitting}
              isLoading={submitting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
            >
              {!submitting && 'Import'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// LookupMasterDialog — manual masterId entry for users whose registration is
// older than the recent-events scan window in GET /master.
// =============================================================================

interface LookupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LookupMasterDialog({ open, onOpenChange }: LookupProps): ReactElement {
  const { lookup } = useVirtualMaster();
  const [masterId, setMasterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMasterId('');
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = masterId.trim();
  const isWellFormed = /^0x[a-fA-F0-9]{8}$/.test(trimmed);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isWellFormed) return;
    setSubmitting(true);
    try {
      await lookup(trimmed as `0x${string}`);
      toast.success('Master linked');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      toast.error("Couldn't link master ID", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 rounded-2xl">
        <form onSubmit={submit}>
          <div className="p-6 pb-0 text-center">
            <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
              Link existing master ID
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed">
              Already registered elsewhere? Paste your 4-byte masterId. We&apos;ll verify it
              against the on-chain registry.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-2">
            <label className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1.5">
              Master ID
            </label>
            <Input
              value={masterId}
              onChange={e => setMasterId(e.target.value)}
              placeholder="0x07a3b1c2"
              autoFocus
              spellCheck={false}
              maxLength={10}
              className="h-10 px-3.5 bg-white text-[14px] font-mono"
            />
            {trimmed && !isWellFormed && (
              <p className="text-[12px] text-red-500 flex items-center gap-1">
                <X className="w-3 h-3" />
                Expected 4 bytes (e.g. 0x07a3b1c2)
              </p>
            )}
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isWellFormed || submitting}
              isLoading={submitting}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
            >
              {!submitting && 'Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
