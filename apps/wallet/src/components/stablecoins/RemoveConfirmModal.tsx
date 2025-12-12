import type { ReactElement } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';

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
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5 text-center">
          <DialogTitle className="sr-only">Remove Token</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm removal of token from local list
          </DialogDescription>

          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>

          <p className="text-[15px] font-semibold text-foreground mb-1">Remove Token?</p>
          <p className="text-[13px] text-muted-foreground mb-6">
            Remove <strong>{coin?.name}</strong> ({coin?.symbol}) from your list? This only removes
            it locally, not from the blockchain.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-10"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
