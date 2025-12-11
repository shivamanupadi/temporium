import { motion } from 'framer-motion'
import { Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getExplorerTxUrl } from '@/lib/tempo-client'

interface TransactionSuccessProps {
  message: string
  txHash: string
  onDone: () => void
  doneLabel?: string
}

export function TransactionSuccess({
  message,
  txHash,
  onDone,
  doneLabel = 'Done',
}: TransactionSuccessProps) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
      >
        <Check className="h-6 w-6 text-success" />
      </motion.div>
      <p className="text-[13px] text-muted-foreground mb-4">{message}</p>
      <div className="flex gap-2">
        <a
          href={getExplorerTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Explorer <ExternalLink className="h-3 w-3" />
        </a>
        <Button className="flex-1 h-10" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  )
}
