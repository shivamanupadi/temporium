import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import {
  StablecoinCard,
  StablecoinEmptyState,
  CreateStablecoinModal,
} from '@/components/stablecoins'
import { useStablecoins } from '@/hooks/useStablecoins'
import { parseAmount } from '@/lib/utils'

export const Route = createFileRoute('/portal/stablecoins/')({
  component: StablecoinsIndexPage,
})

function StablecoinsIndexPage() {
  const { stablecoins, isLoading, createStablecoin, setSupplyCap, refresh } = useStablecoins()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [initialSupplyCap, setInitialSupplyCap] = useState('')

  const resetForm = () => {
    setName('')
    setSymbol('')
    setCurrency('USD')
    setInitialSupplyCap('')
    setShowCreateModal(false)
    setTxHash(null)
  }

  const handleCreate = async () => {
    if (!name || !symbol) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createStablecoin({ name, symbol, currency })
      const tokenAddress = result.stablecoin.address

      // If supply cap is provided, set it after creation
      if (initialSupplyCap) {
        const parsedCap = parseAmount(initialSupplyCap, 6)
        if (parsedCap > 0n) {
          await setSupplyCap({
            token: tokenAddress,
            supplyCap: parsedCap,
          })
        }
      }

      setTxHash(result.receipt.transactionHash)
      toast.success('Stablecoin created!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create stablecoin'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="My Stablecoins"
        action={
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-3">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        }
      />

      {/* Stablecoins List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
          </div>
        ) : stablecoins.length === 0 ? (
          <StablecoinEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {stablecoins.map((coin) => (
              <StablecoinCard key={coin.id} coin={coin} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateStablecoinModal
        isOpen={showCreateModal}
        onClose={resetForm}
        txHash={txHash}
        isSubmitting={isSubmitting}
        name={name}
        setName={setName}
        symbol={symbol}
        setSymbol={setSymbol}
        currency={currency}
        setCurrency={setCurrency}
        supplyCap={initialSupplyCap}
        setSupplyCap={setInitialSupplyCap}
        onSubmit={handleCreate}
        onDone={resetForm}
      />
    </div>
  )
}
