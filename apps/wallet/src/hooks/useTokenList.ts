import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { getTokens, getTokenByAddress, type Token } from '@/lib/tokenlist'
import { getTokenBalance } from '@/lib/tempo-client'
import { TIMING } from '@/lib/constants'

interface UseTokenListReturn {
  tokens: Token[]
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch the full tokenlist
 */
export function useTokenList(): UseTokenListReturn {
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchTokens = async (): Promise<void> => {
      try {
        setIsLoading(true)
        const tokenList = await getTokens()
        if (!cancelled) {
          setTokens(tokenList)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchTokens()

    return () => {
      cancelled = true
    }
  }, [])

  return { tokens, isLoading, error }
}

interface UseTokenReturn {
  token: Token | null
  isLoading: boolean
}

/**
 * Hook to get token metadata by address
 */
export function useToken(address: Address | undefined): UseTokenReturn {
  const [token, setToken] = useState<Token | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setToken(null)
      return
    }

    let cancelled = false

    const fetchToken = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const data = await getTokenByAddress(address)
        if (!cancelled) {
          setToken(data)
        }
      } catch (err) {
        console.error('Failed to fetch token:', err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchToken()

    return () => {
      cancelled = true
    }
  }, [address])

  return { token, isLoading }
}

interface TokenWithBalance extends Token {
  balance: bigint
}

interface UseTokensWithBalancesReturn {
  tokens: TokenWithBalance[]
  totalBalance: bigint
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to get all tokens with their balances
 */
export function useTokensWithBalances(): UseTokensWithBalancesReturn {
  const { address: accountAddress } = useAccount()
  const { tokens, isLoading: tokensLoading, error } = useTokenList()
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map())
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [refetchCounter, setRefetchCounter] = useState(0)

  const refetch = useCallback(() => {
    setRefetchCounter((c) => c + 1)
  }, [])

  useEffect(() => {
    if (!accountAddress || tokens.length === 0) {
      setBalances(new Map())
      return
    }

    let cancelled = false

    const fetchBalances = async (): Promise<void> => {
      setBalancesLoading(true)
      try {
        const balancePromises = tokens.map(async (token) => {
          const balance = await getTokenBalance(token.address, accountAddress)
          return [token.address.toLowerCase(), balance] as const
        })

        const results = await Promise.all(balancePromises)

        if (!cancelled) {
          setBalances(new Map(results))
        }
      } catch (err) {
        console.error('Failed to fetch balances:', err)
      } finally {
        if (!cancelled) {
          setBalancesLoading(false)
        }
      }
    }

    fetchBalances()

    // Refresh balances periodically
    const interval = setInterval(fetchBalances, TIMING.BALANCE_REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [accountAddress, tokens, refetchCounter])

  const tokensWithBalances = useMemo((): TokenWithBalance[] => {
    return tokens.map((token) => ({
      ...token,
      balance: balances.get(token.address.toLowerCase()) || 0n,
    }))
  }, [tokens, balances])

  const totalBalance = useMemo(() => {
    return tokensWithBalances.reduce((sum, token) => sum + token.balance, 0n)
  }, [tokensWithBalances])

  return {
    tokens: tokensWithBalances,
    totalBalance,
    isLoading: tokensLoading || balancesLoading,
    error,
    refetch,
  }
}
