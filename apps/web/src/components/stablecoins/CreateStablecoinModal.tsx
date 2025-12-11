import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/DecimalInput'
import { TransactionSuccess } from '@/components/TransactionSuccess'
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
import { CURRENCIES } from '@/lib/constants'
import type { CreateModalProps } from './types'

export function CreateStablecoinModal({
  isOpen,
  onClose,
  txHash,
  isSubmitting,
  name,
  setName,
  symbol,
  setSymbol,
  currency,
  setCurrency,
  supplyCap,
  setSupplyCap,
  onSubmit,
  onDone,
}: CreateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? 'Stablecoin Created!' : 'Create Stablecoin'}
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new stablecoin</DialogDescription>

          {txHash ? (
            <TransactionSuccess
              message="Your stablecoin has been created successfully"
              txHash={txHash}
              onDone={onDone}
            />
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Name
                  </label>
                  <Input
                    placeholder="My Stablecoin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Symbol
                  </label>
                  <Input
                    placeholder="MYS"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="h-10"
                    maxLength={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Currency
                    </label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      Decimals
                      <Lock className="h-3 w-3" />
                    </label>
                    <Input
                      value="6"
                      disabled
                      className="h-10 bg-muted text-muted-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Supply Cap
                    <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
                  </label>
                  <DecimalInput
                    value={supplyCap}
                    onChange={setSupplyCap}
                    placeholder="Unlimited"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Leave empty for unlimited supply
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1 h-10" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10"
                  onClick={onSubmit}
                  disabled={isSubmitting || !name || !symbol}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
