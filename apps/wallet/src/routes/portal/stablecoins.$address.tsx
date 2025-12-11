import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CircleDollarSign,
  Plus,
  Flame,
  Pause,
  Play,
  Gauge,
  UserPlus,
  UserMinus,
  Ban,
  Trash2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  MintTokensModal,
  BurnTokensModal,
  SupplyCapModal,
  RoleModal,
  BurnBlockedModal,
  RemoveConfirmModal,
} from '@/components/stablecoins'
import { useStablecoin } from '@/hooks/useStablecoin'
import { useTempo } from '@/hooks/useTempo'
import { formatAmount, formatAddress, parseAmount } from '@/lib/utils'
import { getExplorerAddressUrl } from '@/lib/tempo-client'
import type { TokenRole } from '@/types'

export const Route = createFileRoute('/portal/stablecoins/$address')({
  component: StablecoinDashboard,
})

type DashboardModal = 'mint' | 'burn' | 'supply-cap' | 'grant-role' | 'revoke-role' | 'burn-blocked' | 'remove' | null

function StablecoinDashboard(): ReactElement {
  const { address: tokenAddress } = Route.useParams()
  const navigate = useNavigate()
  const { address: userAddress } = useTempo()

  const {
    stablecoin,
    isLoading,
    isNotFound,
    mintTokens,
    burnTokens,
    pauseToken,
    unpauseToken,
    setSupplyCap,
    grantRoles,
    revokeRoles,
    burnBlocked,
    removeStablecoin,
    refresh,
  } = useStablecoin(tokenAddress)

  // Modal state
  const [activeModal, setActiveModal] = useState<DashboardModal>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Form state
  const [amount, setAmount] = useState('')
  const [mintTo, setMintTo] = useState('')
  const [supplyCapInput, setSupplyCapInput] = useState('')
  const [roleAddress, setRoleAddress] = useState('')
  const [selectedRole, setSelectedRole] = useState<TokenRole>('issuer')
  const [burnBlockedFrom, setBurnBlockedFrom] = useState('')

  // Copy state
  const [copied, setCopied] = useState(false)

  const resetForm = (): void => {
    setAmount('')
    setMintTo('')
    setSupplyCapInput('')
    setRoleAddress('')
    setSelectedRole('issuer')
    setBurnBlockedFrom('')
    setActiveModal(null)
    setTxHash(null)
  }

  const openMint = (): void => {
    setAmount('')
    setMintTo(userAddress || '')
    setTxHash(null)
    setActiveModal('mint')
  }

  const openBurn = (): void => {
    setAmount('')
    setTxHash(null)
    setActiveModal('burn')
  }

  const openSupplyCap = (): void => {
    setSupplyCapInput(
      stablecoin?.metadata?.supplyCap
        ? formatAmount(stablecoin.metadata.supplyCap.toString(), stablecoin.metadata.decimals)
        : ''
    )
    setTxHash(null)
    setActiveModal('supply-cap')
  }

  const openGrantRole = (): void => {
    setRoleAddress('')
    setSelectedRole('issuer')
    setTxHash(null)
    setActiveModal('grant-role')
  }

  const openRevokeRole = (): void => {
    setRoleAddress('')
    setSelectedRole('issuer')
    setTxHash(null)
    setActiveModal('revoke-role')
  }

  const openBurnBlocked = (): void => {
    setBurnBlockedFrom('')
    setAmount('')
    setTxHash(null)
    setActiveModal('burn-blocked')
  }

  // Action handlers
  const handlePauseToggle = async (): Promise<void> => {
    if (!stablecoin) return
    setIsSubmitting(true)
    try {
      if (stablecoin.metadata?.paused) {
        await unpauseToken()
        toast.success('Token unpaused')
      } else {
        await pauseToken()
        toast.success('Token paused')
      }
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMint = async (): Promise<void> => {
    if (!amount || !mintTo) {
      toast.error('Please fill in all fields')
      return
    }

    const parsedAmount = parseAmount(amount, stablecoin?.metadata?.decimals ?? 6)
    if (parsedAmount <= 0n) {
      toast.error('Invalid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await mintTokens({
        to: mintTo as `0x${string}`,
        amount: parsedAmount,
      })
      setTxHash(result.receipt.transactionHash)
      toast.success('Tokens minted!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mint tokens'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBurn = async (): Promise<void> => {
    if (!amount) {
      toast.error('Please enter an amount')
      return
    }

    const parsedAmount = parseAmount(amount, stablecoin?.metadata?.decimals ?? 6)
    if (parsedAmount <= 0n) {
      toast.error('Invalid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await burnTokens({ amount: parsedAmount })
      setTxHash(result.receipt.transactionHash)
      toast.success('Tokens burned!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to burn tokens'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetSupplyCap = async (): Promise<void> => {
    if (!supplyCapInput) {
      toast.error('Please enter a supply cap')
      return
    }

    const parsedCap = parseAmount(supplyCapInput, stablecoin?.metadata?.decimals ?? 6)
    if (parsedCap <= 0n) {
      toast.error('Invalid supply cap')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await setSupplyCap(parsedCap)
      setTxHash(result.receipt.transactionHash)
      toast.success('Supply cap updated!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set supply cap'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGrantRole = async (): Promise<void> => {
    if (!roleAddress) {
      toast.error('Please enter an address')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await grantRoles({
        to: roleAddress as `0x${string}`,
        roles: [selectedRole],
      })
      setTxHash(result.receipt.transactionHash)
      toast.success('Role granted!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to grant role'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevokeRole = async (): Promise<void> => {
    if (!roleAddress) {
      toast.error('Please enter an address')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await revokeRoles({
        from: roleAddress as `0x${string}`,
        roles: [selectedRole],
      })
      setTxHash(result.receipt.transactionHash)
      toast.success('Role revoked!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke role'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBurnBlocked = async (): Promise<void> => {
    if (!burnBlockedFrom || !amount) {
      toast.error('Please fill in all fields')
      return
    }

    const parsedAmount = parseAmount(amount, stablecoin?.metadata?.decimals ?? 6)
    if (parsedAmount <= 0n) {
      toast.error('Invalid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await burnBlocked({
        from: burnBlockedFrom as `0x${string}`,
        amount: parsedAmount,
      })
      setTxHash(result.receipt.transactionHash)
      toast.success('Tokens burned from blocked address!')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to burn blocked tokens'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (): Promise<void> => {
    await removeStablecoin()
    toast.success('Removed from list')
    navigate({ to: '/portal/stablecoins' })
  }

  const copyAddress = async (): Promise<void> => {
    await navigator.clipboard.writeText(tokenAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/stablecoins' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    )
  }

  // Not found state
  if (isNotFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/stablecoins' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Stablecoin</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Stablecoin Not Found</h2>
          <p className="text-muted-foreground mb-4">This stablecoin is not in your list</p>
          <Button onClick={() => navigate({ to: '/portal/stablecoins' })}>Back to Stablecoins</Button>
        </div>
      </div>
    )
  }

  const isPaused = stablecoin?.metadata?.paused
  const decimals = stablecoin?.metadata?.decimals ?? 6

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate({ to: '/portal/stablecoins' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">My Stablecoins</h1>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <CircleDollarSign className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{stablecoin?.name}</h1>
                {isPaused && (
                  <span className="text-[11px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Paused
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-muted-foreground">{stablecoin?.symbol}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{stablecoin?.currency}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                >
                  {formatAddress(tokenAddress, 8)}
                  {copied ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                <a
                  href={getExplorerAddressUrl(tokenAddress as `0x${string}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={openMint} className="flex-1 h-11" disabled={isSubmitting}>
            <Plus className="h-4 w-4 mr-2" /> Mint
          </Button>
          <Button onClick={openBurn} variant="outline" className="flex-1 h-11 bg-white" disabled={isSubmitting}>
            <Flame className="h-4 w-4 mr-2" /> Burn
          </Button>
          <Button
            onClick={handlePauseToggle}
            variant="outline"
            className="flex-1 h-11 bg-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" /> Unpause
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" /> Pause
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Supply</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {stablecoin?.totalSupply !== undefined
              ? formatAmount(stablecoin.totalSupply.toString(), decimals)
              : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Supply Cap</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {stablecoin?.metadata?.supplyCap
              ? formatAmount(stablecoin.metadata.supplyCap.toString(), decimals)
              : 'Unlimited'}
          </p>
          <p className="text-[11px] text-muted-foreground">{stablecoin?.metadata?.supplyCap ? stablecoin?.symbol : ''}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Your Balance</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {stablecoin?.userBalance !== undefined
              ? formatAmount(stablecoin.userBalance.toString(), decimals)
              : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
        </div>
      </div>

      {/* Token Settings */}
      <div className="mb-6">
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Token Settings</h2>
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          <SettingsRow
            icon={<Gauge className="h-4 w-4 text-blue-500" />}
            title="Set Supply Cap"
            description="Limit maximum token supply"
            onClick={openSupplyCap}
          />
          <SettingsRow
            icon={<UserPlus className="h-4 w-4 text-green-500" />}
            title="Grant Role"
            description="Give permissions to an address"
            onClick={openGrantRole}
          />
          <SettingsRow
            icon={<UserMinus className="h-4 w-4 text-rose-500" />}
            title="Revoke Role"
            description="Remove permissions from an address"
            onClick={openRevokeRole}
          />
          <SettingsRow
            icon={<Ban className="h-4 w-4 text-red-400" />}
            title="Burn Blocked"
            description="Burn tokens from a blocked address"
            onClick={openBurnBlocked}
            isLast
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Danger Zone</h2>
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          <SettingsRow
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            title="Remove from List"
            description="Remove from your local storage only"
            onClick={() => setActiveModal('remove')}
            variant="danger"
            isLast
          />
        </div>
      </div>

      {/* Modals */}
      <MintTokensModal
        isOpen={activeModal === 'mint'}
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        amount={amount}
        setAmount={setAmount}
        mintTo={mintTo}
        setMintTo={setMintTo}
        onSubmit={handleMint}
        onClose={resetForm}
      />

      <BurnTokensModal
        isOpen={activeModal === 'burn'}
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        amount={amount}
        setAmount={setAmount}
        onSubmit={handleBurn}
        onClose={resetForm}
      />

      <SupplyCapModal
        isOpen={activeModal === 'supply-cap'}
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        supplyCap={supplyCapInput}
        setSupplyCap={setSupplyCapInput}
        onSubmit={handleSetSupplyCap}
        onClose={resetForm}
      />

      <RoleModal
        isOpen={activeModal === 'grant-role'}
        mode="grant"
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        roleAddress={roleAddress}
        setRoleAddress={setRoleAddress}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        onSubmit={handleGrantRole}
        onClose={resetForm}
      />

      <RoleModal
        isOpen={activeModal === 'revoke-role'}
        mode="revoke"
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        roleAddress={roleAddress}
        setRoleAddress={setRoleAddress}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        onSubmit={handleRevokeRole}
        onClose={resetForm}
      />

      <BurnBlockedModal
        isOpen={activeModal === 'burn-blocked'}
        selectedCoin={stablecoin ?? null}
        txHash={txHash}
        isSubmitting={isSubmitting}
        burnFrom={burnBlockedFrom}
        setBurnFrom={setBurnBlockedFrom}
        amount={amount}
        setAmount={setAmount}
        onSubmit={handleBurnBlocked}
        onClose={resetForm}
      />

      <RemoveConfirmModal
        coin={activeModal === 'remove' ? stablecoin ?? null : null}
        onConfirm={handleRemove}
        onCancel={resetForm}
      />
    </div>
  )
}

interface SettingsRowProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  variant?: 'default' | 'danger'
  isLast?: boolean
}

function SettingsRow({ icon, title, description, onClick, variant = 'default', isLast = false }: SettingsRowProps): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 transition-colors ${
        variant === 'danger' ? 'hover:bg-red-50' : 'hover:bg-muted/50'
      } ${!isLast ? 'border-b border-[rgba(0,0,0,0.03)]' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          variant === 'danger' ? 'bg-red-50' : 'bg-primary/10'
        }`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`text-[13px] font-medium ${variant === 'danger' ? 'text-red-600' : 'text-foreground'}`}>
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
