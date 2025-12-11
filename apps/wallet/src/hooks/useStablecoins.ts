import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWalletClient, useAccount } from 'wagmi'
import {
  getStablecoinsByCreator,
  saveStablecoin,
  deleteStablecoin,
  type Stablecoin,
} from '@/lib/stablecoins-storage'
import { Actions, tempoPublicClient } from '@/lib/tempo-client'
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants'
import type { Address } from 'viem'
import type { TokenRole } from '@/types'

export interface TokenMetadata {
  name: string
  symbol: string
  currency: string
  decimals: number
  paused?: boolean
  supplyCap?: bigint
  quoteToken?: Address
}

export interface StablecoinWithMetadata extends Stablecoin {
  metadata?: TokenMetadata
  totalSupply?: bigint
  userBalance?: bigint
}

interface UseStablecoinsReturn {
  stablecoins: StablecoinWithMetadata[]
  isLoading: boolean
  createStablecoin: (params: { name: string; symbol: string; currency: string }) => Promise<{ stablecoin: Stablecoin; receipt: { transactionHash: string } }>
  mintTokens: (params: { token: Address; to: Address; amount: bigint }) => Promise<{ receipt: { transactionHash: string } }>
  burnTokens: (params: { token: Address; amount: bigint }) => Promise<{ receipt: { transactionHash: string } }>
  pauseToken: (token: Address) => Promise<{ receipt: { transactionHash: string } }>
  unpauseToken: (token: Address) => Promise<{ receipt: { transactionHash: string } }>
  setSupplyCap: (params: { token: Address; supplyCap: bigint }) => Promise<{ receipt: { transactionHash: string } }>
  grantRoles: (params: { token: Address; to: Address; roles: readonly TokenRole[] }) => Promise<{ receipt: { transactionHash: string } }>
  revokeRoles: (params: { token: Address; from: Address; roles: readonly TokenRole[] }) => Promise<{ receipt: { transactionHash: string } }>
  checkRole: (params: { token: Address; account: Address; role: TokenRole }) => Promise<boolean>
  burnBlocked: (params: { token: Address; from: Address; amount: bigint }) => Promise<{ receipt: { transactionHash: string } }>
  removeStablecoin: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useStablecoins(): UseStablecoinsReturn {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [stablecoins, setStablecoins] = useState<StablecoinWithMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadStablecoins = useCallback(async () => {
    if (!address) {
      setStablecoins([])
      setIsLoading(false)
      return
    }

    try {
      const stored = await getStablecoinsByCreator(address.toLowerCase() as Address)

      // Fetch metadata for each stablecoin
      const withMetadata = await Promise.all(
        stored.map(async (coin) => {
          try {
            const [metadata, balance] = await Promise.all([
              Actions.token.getMetadata(tempoPublicClient, { token: coin.address }),
              Actions.token.getBalance(tempoPublicClient, { token: coin.address, account: address }),
            ])
            return {
              ...coin,
              metadata: metadata as TokenMetadata,
              userBalance: balance,
            }
          } catch (err) {
            console.error(`Failed to fetch metadata for ${coin.address}:`, err)
            return coin
          }
        })
      )

      setStablecoins(withMetadata)
    } catch (error) {
      console.error('Failed to load stablecoins:', error)
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    loadStablecoins()
  }, [loadStablecoins])

  const createStablecoin = useCallback(
    async (params: { name: string; symbol: string; currency: string }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected')

      const result = await Actions.token.createSync(walletClient, {
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      // The result contains the token address from the Create event
      const tokenAddress = result.token as Address

      // Save to local storage
      const stablecoin = await saveStablecoin({
        address: tokenAddress.toLowerCase() as Address,
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        creator: address.toLowerCase() as Address,
        txHash: result.receipt.transactionHash,
      })

      // Refresh the list
      await loadStablecoins()

      return { stablecoin, receipt: result.receipt }
    },
    [walletClient, address, loadStablecoins]
  )

  const mintTokens = useCallback(
    async (params: { token: Address; to: Address; amount: bigint }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.mintSync(walletClient, {
        token: params.token,
        to: params.to,
        amount: params.amount,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  const burnTokens = useCallback(
    async (params: { token: Address; amount: bigint }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.burnSync(walletClient, {
        token: params.token,
        amount: params.amount,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  const pauseToken = useCallback(
    async (token: Address) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.pauseSync(walletClient, { token, feeToken: DEFAULT_FEE_TOKEN_ADDRESS })
      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  const unpauseToken = useCallback(
    async (token: Address) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.unpauseSync(walletClient, { token, feeToken: DEFAULT_FEE_TOKEN_ADDRESS })
      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  const setSupplyCap = useCallback(
    async (params: { token: Address; supplyCap: bigint }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.setSupplyCapSync(walletClient, {
        token: params.token,
        supplyCap: params.supplyCap,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  const removeStablecoin = useCallback(
    async (id: string) => {
      await deleteStablecoin(id)
      await loadStablecoins()
    },
    [loadStablecoins]
  )

  const grantRoles = useCallback(
    async (params: { token: Address; roles: readonly TokenRole[]; to: Address }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.grantRolesSync(walletClient, {
        token: params.token,
        roles: params.roles,
        to: params.to,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      return result
    },
    [walletClient]
  )

  const revokeRoles = useCallback(
    async (params: { token: Address; roles: readonly TokenRole[]; from: Address }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.revokeRolesSync(walletClient, {
        token: params.token,
        roles: params.roles,
        from: params.from,
      })

      return result
    },
    [walletClient]
  )

  const checkRole = useCallback(
    async (params: { token: Address; account: Address; role: TokenRole }) => {
      const hasRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: params.account,
        role: params.role,
      })

      return hasRole
    },
    []
  )

  const burnBlocked = useCallback(
    async (params: { token: Address; from: Address; amount: bigint }) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const result = await Actions.token.burnBlockedSync(walletClient, {
        token: params.token,
        from: params.from,
        amount: params.amount,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      })

      await loadStablecoins()
      return result
    },
    [walletClient, loadStablecoins]
  )

  return {
    stablecoins,
    isLoading,
    createStablecoin,
    mintTokens,
    burnTokens,
    pauseToken,
    unpauseToken,
    setSupplyCap,
    grantRoles,
    revokeRoles,
    checkRole,
    burnBlocked,
    removeStablecoin,
    refresh: loadStablecoins,
  }
}

// Hook to get metadata for a specific token
export function useTokenMetadata(tokenAddress: Address | undefined): ReturnType<typeof useQuery<TokenMetadata | null>> {
  return useQuery({
    queryKey: ['tokenMetadata', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      const metadata = await Actions.token.getMetadata(tempoPublicClient, { token: tokenAddress })
      return metadata as TokenMetadata
    },
    enabled: !!tokenAddress,
  })
}
