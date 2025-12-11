import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins'

interface RemoveConfirmModalProps {
  coin: StablecoinWithMetadata | null
  onConfirm: () => void
  onCancel: () => void
}

export function RemoveConfirmModal({ coin, onConfirm, onCancel }: RemoveConfirmModalProps) {
  return (
    <Dialog open={!!coin} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-[15px] font-semibold text-foreground">
          Remove Stablecoin
        </DialogTitle>
        <DialogDescription className="sr-only">
          Confirm removal of stablecoin from local list
        </DialogDescription>
        <div className="py-4">
          <p className="text-[13px] text-muted-foreground">
            Remove <span className="font-medium text-foreground">{coin?.symbol}</span> from your list?
          </p>
          <p className="text-[12px] text-muted-foreground mt-2">
            This only removes it from your local list, not from the blockchain.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1 h-10" onClick={onConfirm}>
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
