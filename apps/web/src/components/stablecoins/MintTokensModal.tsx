import { motion } from 'framer-motion'
import { Loader2, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/DecimalInput'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { getExplorerTxUrl } from '@/lib/tempo-client'
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins'

interface MintTokensModalProps {
  isOpen: boolean
  selectedCoin: StablecoinWithMetadata | null
  txHash: string | null
  isSubmitting: boolean
  amount: string
  setAmount: (v: string) => void
  mintTo: string
  setMintTo: (v: string) => void
  onSubmit: () => void
  onClose: () => void
}

export function MintTokensModal({
  isOpen,
  selectedCoin,
  txHash,
  isSubmitting,
  amount,
  setAmount,
  mintTo,
  setMintTo,
  onSubmit,
  onClose,
}: MintTokensModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? 'Tokens Minted!' : `Mint ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Mint new tokens</DialogDescription>

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
                Successfully minted {amount} {selectedCoin?.symbol}
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
                    Recipient Address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={mintTo}
                    onChange={(e) => setMintTo(e.target.value)}
                    className="h-10 font-mono text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Amount
                  </label>
                  <DecimalInput value={amount} onChange={setAmount} />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1 h-10" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10"
                  onClick={onSubmit}
                  disabled={isSubmitting || !amount || !mintTo}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mint'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
