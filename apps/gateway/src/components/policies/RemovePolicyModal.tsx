import type { ReactElement } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface RemovePolicyModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemovePolicyModal({
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: RemovePolicyModalProps): ReactElement {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Remove Policy</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            This will remove the policy from your local list only. The policy will still exist
            on-chain and can be re-imported later.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isLoading}>
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
      </DialogContent>
    </Dialog>
  );
}
