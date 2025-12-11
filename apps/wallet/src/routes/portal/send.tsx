import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ReactElement } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, ExternalLink, DollarSign, Loader2, Clock, AlertTriangle, Users, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
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
import { useTempo, useTokenBalance } from '@/hooks/useTempo'
import { useTokenList } from '@/hooks/useTokenList'
import { formatAddress, formatAmount, parseAmount, isValidAddress, cn } from '@/lib/utils'
import { SCHEDULE_PRESETS } from '@/lib/constants'
import { getExplorerTxUrl } from '@/lib/tempo-client'
import { saveScheduledTransaction } from '@/lib/scheduled-storage'
import type { Address } from 'viem'
import { getTokenColors, type Token } from '@/lib/tokenlist'
import { useContacts } from '@/hooks/useContacts'

export const Route = createFileRoute('/portal/send')({
  component: SendPage,
})

type ModalState = 'confirm' | 'pending' | 'success' | null

function SendPage(): ReactElement | null {
  const { address, sendPayment, sendScheduledPayment } = useTempo()
  const navigate = useNavigate()
  const { tokens, isLoading: tokensLoading } = useTokenList()
  const { contacts } = useContacts()
  const [showContacts, setShowContacts] = useState(false)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [feeToken, setFeeToken] = useState<Token | null>(null)
  const [modalState, setModalState] = useState<ModalState>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduleSeconds, setScheduleSeconds] = useState(SCHEDULE_PRESETS[0].seconds)
  const [scheduledForTimestamp, setScheduledForTimestamp] = useState<number | null>(null)

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      const defaultToken = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0]
      setSelectedToken(defaultToken)
      setFeeToken(defaultToken)
    }
  }, [tokens, selectedToken])

  const balance = useTokenBalance(selectedToken?.address)

  if (!address) return null

  const parsedAmount = selectedToken ? parseAmount(amount, selectedToken.decimals) : 0n
  const hasBalance = balance.data?.value && balance.data.value >= parsedAmount
  const isValidForm = isValidAddress(recipient) && parsedAmount > 0n && hasBalance && selectedToken && feeToken

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !selectedToken || !feeToken || !address) return
    setModalState('pending')
    try {
      let hash: string

      if (isScheduled) {
        // Calculate the scheduled timestamp
        const scheduledFor = Math.floor(Date.now() / 1000) + scheduleSeconds
        setScheduledForTimestamp(scheduledFor)

        // Send scheduled payment with validAfter
        hash = await sendScheduledPayment({
          to: recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: memo || undefined,
          scheduledFor,
        })

        // Save to IndexedDB for tracking
        await saveScheduledTransaction({
          txHash: hash,
          from: address as Address,
          to: recipient as Address,
          amount: parsedAmount.toString(),
          token: selectedToken.address,
          tokenSymbol: selectedToken.symbol,
          tokenDecimals: selectedToken.decimals,
          feeToken: feeToken.address,
          memo: memo || undefined,
          scheduledFor,
        })

        toast.success('Payment scheduled!')
      } else {
        // Send immediate payment
        hash = await sendPayment({
          to: recipient as Address,
          amount: parsedAmount,
          token: selectedToken.address,
          feeToken: feeToken.address,
          memo: memo || undefined,
        })
        toast.success('Payment sent!')
      }

      setTxHash(hash)
      setModalState('success')
    } catch (err) {
      console.error(err)
      toast.error(isScheduled ? 'Failed to schedule payment' : 'Failed to send payment')
      setModalState(null)
    }
  }

  const resetForm = (): void => {
    setRecipient('')
    setAmount('')
    setMemo('')
    setTxHash(null)
    setModalState(null)
    setIsScheduled(false)
    setScheduleSeconds(SCHEDULE_PRESETS[0].seconds)
    setScheduledForTimestamp(null)
  }

  const handleCloseModal = (): void => {
    if (modalState === 'success') {
      resetForm()
    } else if (modalState !== 'pending') {
      setModalState(null)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate({ to: '/portal/dashboard' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">Send</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-5 space-y-5">
        {/* Token Pills */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Token</label>
          <div className="flex gap-1.5 flex-wrap">
            {tokensLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
              ))
            ) : (
              tokens.map((token) => {
                const colors = getTokenColors(token.symbol)
                const isSelected = selectedToken?.address === token.address
                return (
                  <button
                    key={token.address}
                    onClick={() => setSelectedToken(token)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.bg,
                        color: isSelected ? 'white' : colors.text
                      }}
                    >
                      <DollarSign className="h-2.5 w-2.5" />
                    </span>
                    {token.symbol}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Amount</label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-light text-border">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                if (val.split('.').length <= 2) setAmount(val)
              }}
              className="w-full text-4xl font-light text-foreground bg-transparent border-none outline-none pl-7 placeholder:text-border"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px] text-muted-foreground">{selectedToken?.symbol}</span>
            <button
              onClick={() => {
                if (balance.data?.value && selectedToken) {
                  setAmount(formatAmount(balance.data.value.toString(), selectedToken.decimals))
                }
              }}
              className="text-[12px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {balance.isLoading ? '...' : formatAmount(balance.data?.value.toString() || '0', selectedToken?.decimals)} available
            </button>
          </div>
          {amount && parsedAmount > 0n && !hasBalance && (
            <p className="text-[12px] text-destructive mt-1">Insufficient balance</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Recipient */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recipient</label>
            {contacts.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowContacts(!showContacts)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Users className="h-3 w-3" />
                  Contacts
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showContacts && 'rotate-180')} />
                </button>
                {showContacts && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowContacts(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-white shadow-lg z-20 overflow-hidden">
                      <div className="max-h-48 overflow-y-auto">
                        {contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              setRecipient(contact.address)
                              setShowContacts(false)
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-semibold text-primary">
                                {contact.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">{contact.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{contact.address.slice(0, 10)}...{contact.address.slice(-6)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Input
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="font-mono text-[13px] h-10"
          />
          {recipient && !isValidAddress(recipient) && (
            <p className="text-[11px] text-destructive mt-1.5">Invalid address</p>
          )}
        </div>

        {/* Memo */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Memo <span className="text-muted-foreground/60 normal-case">(optional)</span></label>
          <Input
            placeholder="Add a note..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="text-[13px] h-10"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Schedule Toggle */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3 block">When to send</label>
          <div className="flex gap-2">
            <label
              className={cn(
                'flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                !isScheduled
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                !isScheduled ? 'border-primary' : 'border-muted-foreground/30'
              )}>
                {!isScheduled && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <input
                type="radio"
                name="scheduleType"
                checked={!isScheduled}
                onChange={() => setIsScheduled(false)}
                className="sr-only"
              />
              <span className={cn(
                'text-[13px] font-medium',
                !isScheduled ? 'text-foreground' : 'text-muted-foreground'
              )}>
                Send now
              </span>
            </label>

            <label
              className={cn(
                'flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                isScheduled
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                isScheduled ? 'border-primary' : 'border-muted-foreground/30'
              )}>
                {isScheduled && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <input
                type="radio"
                name="scheduleType"
                checked={isScheduled}
                onChange={() => setIsScheduled(true)}
                className="sr-only"
              />
              <Clock className={cn(
                'h-4 w-4 shrink-0',
                isScheduled ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[13px] font-medium',
                isScheduled ? 'text-foreground' : 'text-muted-foreground'
              )}>
                Schedule
              </span>
            </label>
          </div>
        </div>

        {/* Schedule Time Selection */}
        {isScheduled && (
          <div className="space-y-3">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Execute in</label>
            <div className="flex gap-1.5 flex-wrap">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  onClick={() => setScheduleSeconds(preset.seconds)}
                  className={cn(
                    'px-4 py-2 rounded-full text-[13px] font-medium transition-all',
                    scheduleSeconds === preset.seconds
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Warning about no cancellation */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-[12px] text-warning leading-relaxed">
                Scheduled transactions cannot be cancelled once submitted. The payment will execute automatically at the scheduled time.
              </p>
            </div>
          </div>
        )}

        {/* Fee Token */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[12px] text-muted-foreground">Pay fee with</span>
          <Select
            value={feeToken?.address}
            onValueChange={(value) => {
              const token = tokens.find(t => t.address === value)
              if (token) setFeeToken(token)
            }}
          >
            <SelectTrigger className="w-auto h-8 min-w-[100px] text-[12px]">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {tokens.map((token) => (
                <SelectItem key={token.address} value={token.address}>
                  {token.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Submit */}
        <Button
          className="w-full h-11 text-[14px] font-medium"
          disabled={!isValidForm}
          onClick={() => setModalState('confirm')}
        >
          {isScheduled ? 'Review Scheduled Payment' : 'Review Payment'}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent hideClose={modalState === 'pending'} className="sm:max-w-sm p-0 overflow-hidden">
          {modalState === 'confirm' && selectedToken && (() => {
              const colors = getTokenColors(selectedToken.symbol)
              return (
                <div className="p-6">
                  <DialogTitle className="sr-only">{isScheduled ? 'Confirm Scheduled Payment' : 'Confirm Payment'}</DialogTitle>
                  <DialogDescription className="sr-only">{isScheduled ? 'Confirm your scheduled payment' : 'Confirm your payment'}</DialogDescription>

                  {/* Amount Display */}
                  <div className="text-center mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <DollarSign className="h-7 w-7" style={{ color: colors.text }} />
                    </div>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-4xl font-semibold tracking-tight text-foreground">{amount}</span>
                      <span className="text-xl font-medium text-muted-foreground">{selectedToken.symbol}</span>
                    </div>
                    {isScheduled && (
                      <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-primary/10">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[12px] font-medium text-primary">
                          {new Date(Date.now() + scheduleSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[13px] text-muted-foreground">To</span>
                      <span className="font-mono text-[13px] text-foreground">{formatAddress(recipient, 8)}</span>
                    </div>
                    {memo && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[13px] text-muted-foreground">Memo</span>
                        <span className="text-[13px] text-foreground truncate max-w-[180px]">{memo}</span>
                      </div>
                    )}
                  </div>

                  {/* Warning for scheduled */}
                  {isScheduled && (
                    <p className="text-[11px] text-center text-muted-foreground mb-5">
                      Scheduled payments cannot be cancelled
                    </p>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full h-11" onClick={handleSubmit}>
                      {isScheduled ? 'Schedule Payment' : 'Send Payment'}
                    </Button>
                    <Button variant="ghost" className="w-full h-10 text-muted-foreground" onClick={() => setModalState(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            })()}

          {modalState === 'pending' && selectedToken && (
            <div className="p-8 text-center">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">{isScheduled ? 'Scheduling payment' : 'Processing payment'}</DialogDescription>

              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-[14px] text-muted-foreground">
                {isScheduled ? 'Scheduling' : 'Sending'} {amount} {selectedToken.symbol}
              </p>
            </div>
          )}

          {modalState === 'success' && txHash && selectedToken && (
            <div className="p-6 text-center">
              <DialogTitle className="sr-only">{isScheduled ? 'Scheduled' : 'Success'}</DialogTitle>
              <DialogDescription className="sr-only">{isScheduled ? 'Payment scheduled' : 'Payment sent'}</DialogDescription>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',
                  isScheduled ? 'bg-primary/10' : 'bg-emerald-500/10'
                )}
              >
                {isScheduled ? (
                  <Clock className="h-7 w-7 text-primary" />
                ) : (
                  <Check className="h-7 w-7 text-emerald-500" />
                )}
              </motion.div>

              <p className="text-xl font-semibold text-foreground mb-1">
                {isScheduled ? 'Payment Scheduled' : 'Payment Sent'}
              </p>
              <p className="text-[14px] text-muted-foreground">
                {amount} {selectedToken.symbol} to {formatAddress(recipient, 4)}
              </p>
              {isScheduled && scheduledForTimestamp && (
                <p className="text-[13px] text-primary mt-2">
                  Executes at {new Date(scheduledForTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              <button
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                className="inline-flex items-center gap-1.5 mt-5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-mono">{txHash.slice(0, 8)}...{txHash.slice(-6)}</span>
                <ExternalLink className="h-3 w-3" />
              </button>

              <div className="mt-6 space-y-2">
                <Button className="w-full h-11" onClick={resetForm}>
                  Send Another
                </Button>
                {isScheduled && (
                  <Button variant="ghost" className="w-full h-10 text-muted-foreground" onClick={() => navigate({ to: '/portal/scheduled' })}>
                    View Scheduled
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
