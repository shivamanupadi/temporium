import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ReactElement } from 'react'
import { ArrowLeft, Clock, Check, X, ExternalLink, RefreshCw, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScheduledTransactions } from '@/hooks/useScheduledTransactions'
import { formatAddress, formatAmount, formatTimeAgo, cn } from '@/lib/utils'
import { TIMING } from '@/lib/constants'
import { getExplorerTxUrl } from '@/lib/tempo-client'
import type { ScheduledTransaction } from '@/lib/scheduled-storage'

export const Route = createFileRoute('/portal/scheduled')({
  component: ScheduledPage,
})

function ScheduledPage(): ReactElement {
  const navigate = useNavigate()
  const {
    pendingTransactions,
    completedTransactions,
    isLoading,
    isChecking,
    refresh,
  } = useScheduledTransactions()

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: '/portal/dashboard' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Scheduled</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isLoading || isChecking}
          className="h-8 px-2"
        >
          <RefreshCw className={cn('h-4 w-4', (isLoading || isChecking) && 'animate-spin')} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'completed')}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="pending" className="flex-1">
            Pending
            {pendingTransactions.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                {pendingTransactions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            Completed
            {completedTransactions.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                {completedTransactions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0">
          {isLoading ? (
            <LoadingState />
          ) : pendingTransactions.length === 0 ? (
            <EmptyState type="pending" />
          ) : (
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <TransactionCard key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {isLoading ? (
            <LoadingState />
          ) : completedTransactions.length === 0 ? (
            <EmptyState type="completed" />
          ) : (
            <div className="space-y-3">
              {completedTransactions.map((tx) => (
                <TransactionCard key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: ScheduledTransaction }): ReactElement {
  const now = Math.floor(Date.now() / 1000)
  const isPending = transaction.status === 'pending'
  const isPastSchedule = transaction.scheduledFor <= now
  const isExecuted = transaction.status === 'executed'
  const isFailed = transaction.status === 'failed'

  return (
    <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-4">
      {/* Amount and Status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-semibold text-foreground">
            ${formatAmount(transaction.amount, transaction.tokenDecimals)}
            <span className="text-muted-foreground font-normal text-sm ml-1">
              {transaction.tokenSymbol}
            </span>
          </p>
          <p className="text-[12px] text-muted-foreground font-mono">
            To: {formatAddress(transaction.to, 6)}
          </p>
        </div>
        <StatusBadge status={transaction.status} isPastSchedule={isPastSchedule} />
      </div>

      {/* Time Info */}
      <div className="flex items-center gap-2 mb-3">
        {isPending && !isPastSchedule && (
          <CountdownTimer scheduledFor={transaction.scheduledFor} />
        )}
        {isPending && isPastSchedule && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            <span>Executing soon...</span>
          </div>
        )}
        {isExecuted && transaction.executedAt && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" />
            <span>Executed {formatTimeAgo(transaction.executedAt)}</span>
          </div>
        )}
        {isFailed && (
          <div className="flex items-center gap-1.5 text-[12px] text-destructive">
            <X className="h-3.5 w-3.5" />
            <span>Failed</span>
          </div>
        )}
      </div>

      {/* Memo */}
      {transaction.memo && (
        <p className="text-[12px] text-muted-foreground mb-3 truncate">
          Memo: {transaction.memo}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <a
          href={getExplorerTxUrl(transaction.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 transition-colors"
        >
          View on Explorer <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-border">•</span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {formatAddress(transaction.txHash, 8)}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status, isPastSchedule }: { status: string; isPastSchedule: boolean }): ReactElement | null {
  if (status === 'pending' && isPastSchedule) {
    return (
      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
        Processing
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="px-2 py-1 rounded-full bg-warning/10 text-warning text-[11px] font-medium flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Scheduled
      </span>
    )
  }

  if (status === 'executed') {
    return (
      <span className="px-2 py-1 rounded-full bg-success/10 text-success text-[11px] font-medium flex items-center gap-1">
        <Check className="h-3 w-3" />
        Executed
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <span className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium flex items-center gap-1">
        <X className="h-3 w-3" />
        Failed
      </span>
    )
  }

  return null
}

function CountdownTimer({ scheduledFor }: { scheduledFor: number }): ReactElement {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const updateCountdown = (): void => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = scheduledFor - now

      if (remaining <= 0) {
        setCountdown('Now')
        return
      }

      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60

      if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`)
      } else {
        setCountdown(`${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, TIMING.COUNTDOWN_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [scheduledFor])

  return (
    <div className="flex items-center gap-1.5 text-[12px] text-primary font-medium">
      <Clock className="h-3.5 w-3.5" />
      <span>Executes in {countdown}</span>
    </div>
  )
}

function LoadingState(): ReactElement {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-4 animate-pulse">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="h-6 w-24 bg-muted rounded mb-2" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ type }: { type: 'pending' | 'completed' }): ReactElement {
  const navigate = useNavigate()

  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Calendar className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-[14px] font-medium text-foreground mb-1">
        {type === 'pending' ? 'No pending transactions' : 'No completed transactions'}
      </p>
      <p className="text-[13px] text-muted-foreground mb-4">
        {type === 'pending'
          ? 'Schedule a payment to see it here'
          : 'Completed scheduled payments will appear here'}
      </p>
      {type === 'pending' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: '/portal/send' })}
        >
          Schedule a Payment
        </Button>
      )}
    </div>
  )
}
