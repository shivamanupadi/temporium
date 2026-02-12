import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import type { StablecoinWithMetadata } from '@/types';

interface RemoveConfirmModalProps {
  coin: StablecoinWithMetadata | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveConfirmModal({
  coin,
  isLoading,
  onConfirm,
  onCancel,
}: RemoveConfirmModalProps): ReactElement {
  const handleOpenChange = (open: boolean): void => {
    if (!open && !isLoading) {
      onCancel();
    }
  };

  return (
    <Dialog open={!!coin} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        <div className="px-6 pt-6 pb-5 pr-14">
          <DialogTitle className="text-lg font-bold text-[#2D3436]">Remove Token</DialogTitle>
          <DialogDescription className="text-[13px] font-light text-[#9B9590]">This only removes it from your account</DialogDescription>
        </div>
        <div className="px-6 pb-4">
          <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
            <p className="text-[14px] font-semibold text-[#2D3436] mb-1">{coin?.name} ({coin?.symbol})</p>
            <p className="text-[13px] font-light text-[#9B9590]">
              This token will be removed from your list. It will not be deleted from the blockchain and can be re-added later.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {isLoading ? 'Removing...' : 'Remove'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
