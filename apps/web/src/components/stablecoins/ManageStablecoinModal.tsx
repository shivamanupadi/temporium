import { Pause, Play, Plus, Flame, Gauge, UserPlus, UserMinus, Ban, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatAddress } from '@/lib/utils'
import { getExplorerAddressUrl } from '@/lib/tempo-client'
import type { ManageModalProps } from './types'

interface ManageActionButtonProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

function ManageActionButton({ icon, title, description, onClick, variant = 'default', disabled }: ManageActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
        variant === 'danger' ? 'hover:bg-red-50' : 'hover:bg-muted'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      <div>
        <p className={`text-[13px] font-medium ${variant === 'danger' ? 'text-red-600' : 'text-foreground'}`}>
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

export function ManageStablecoinModal({
  isOpen,
  selectedCoin,
  isSubmitting,
  onPause,
  onUnpause,
  onMint,
  onBurn,
  onSetSupplyCap,
  onGrantRole,
  onRevokeRole,
  onBurnBlocked,
  onRemove,
  onClose,
}: ManageModalProps) {
  if (!selectedCoin) return null

  const isPaused = selectedCoin.metadata?.paused

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-1">
            Manage {selectedCoin.symbol}
          </DialogTitle>
          <DialogDescription className="sr-only">Manage stablecoin settings</DialogDescription>

          <button
            onClick={() => window.open(getExplorerAddressUrl(selectedCoin.address), '_blank')}
            className="text-[11px] text-muted-foreground hover:text-primary font-mono transition-colors mb-4 block"
          >
            {formatAddress(selectedCoin.address, 12)}
          </button>

          {isSubmitting ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-[13px] text-muted-foreground mt-2">Processing...</p>
            </div>
          ) : (
            <div className="space-y-1">
              <ManageActionButton
                icon={isPaused ? <Play className="h-4 w-4 text-success" /> : <Pause className="h-4 w-4 text-amber-500" />}
                title={isPaused ? 'Unpause Token' : 'Pause Token'}
                description={isPaused ? 'Allow transfers to resume' : 'Temporarily stop all transfers'}
                onClick={isPaused ? onUnpause : onPause}
              />

              <ManageActionButton
                icon={<Plus className="h-4 w-4 text-primary" />}
                title="Mint Tokens"
                description="Issue new tokens to an address"
                onClick={() => onMint(selectedCoin)}
              />

              <ManageActionButton
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                title="Burn Tokens"
                description="Remove tokens from circulation"
                onClick={() => onBurn(selectedCoin)}
              />

              <ManageActionButton
                icon={<Gauge className="h-4 w-4 text-blue-500" />}
                title="Set Supply Cap"
                description="Limit maximum token supply"
                onClick={() => onSetSupplyCap(selectedCoin)}
              />

              <ManageActionButton
                icon={<UserPlus className="h-4 w-4 text-green-500" />}
                title="Grant Role"
                description="Give permissions to an address"
                onClick={() => onGrantRole(selectedCoin)}
              />

              <ManageActionButton
                icon={<UserMinus className="h-4 w-4 text-rose-500" />}
                title="Revoke Role"
                description="Remove permissions from an address"
                onClick={() => onRevokeRole(selectedCoin)}
              />

              <ManageActionButton
                icon={<Ban className="h-4 w-4 text-red-400" />}
                title="Burn Blocked"
                description="Burn tokens from a blocked address"
                onClick={() => onBurnBlocked(selectedCoin)}
              />

              <ManageActionButton
                icon={<Trash2 className="h-4 w-4 text-red-500" />}
                title="Remove from List"
                description="Remove from your local list only"
                onClick={() => onRemove(selectedCoin)}
                variant="danger"
              />
            </div>
          )}

          <Button variant="outline" className="w-full h-10 mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
