import { motion } from 'framer-motion'
import { Loader2, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getExplorerTxUrl } from '@/lib/tempo-client'
import { ROLE_OPTIONS } from '@/lib/constants'
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins'
import type { TokenRole } from '@/types'

interface RoleModalProps {
  isOpen: boolean
  mode: 'grant' | 'revoke'
  selectedCoin: StablecoinWithMetadata | null
  txHash: string | null
  isSubmitting: boolean
  roleAddress: string
  setRoleAddress: (v: string) => void
  selectedRole: TokenRole
  setSelectedRole: (v: TokenRole) => void
  onSubmit: () => void
  onClose: () => void
}

export function RoleModal({
  isOpen,
  mode,
  selectedCoin,
  txHash,
  isSubmitting,
  roleAddress,
  setRoleAddress,
  selectedRole,
  setSelectedRole,
  onSubmit,
  onClose,
}: RoleModalProps) {
  const isGrant = mode === 'grant'
  const title = isGrant ? 'Grant Role' : 'Revoke Role'
  const successMessage = isGrant ? 'Role granted successfully' : 'Role revoked successfully'
  const buttonLabel = isGrant ? 'Grant' : 'Revoke'

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? `${title}!` : `${title} - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>

          {txHash ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-6 w-6 text-success" />
              </motion.div>
              <p className="text-[13px] text-muted-foreground mb-4">
                {successMessage}
              </p>
              <div className="flex gap-2">
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
                <Button className="flex-1 h-10" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={roleAddress}
                    onChange={(e) => setRoleAddress(e.target.value)}
                    className="h-10 font-mono text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Role
                  </label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TokenRole)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div>
                            <span className="font-medium">{role.label}</span>
                            <span className="text-muted-foreground ml-2 text-[11px]">
                              {role.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1 h-10" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10"
                  variant={isGrant ? 'default' : 'destructive'}
                  onClick={onSubmit}
                  disabled={isSubmitting || !roleAddress}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
