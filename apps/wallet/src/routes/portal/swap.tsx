import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpDown, Check, ExternalLink, DollarSign, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { formatAmount, parseAmount, cn } from '@/lib/utils'
import { TIMING } from '@/lib/constants'
import { getSwapQuote, getExplorerTxUrl } from '@/lib/tempo-client'
import type { Address } from 'viem'
import { getTokenColors, type Token } from '@/lib/tokenlist'

export const Route = createFileRoute('/portal/swap')({
  component: SwapPage,
})

type ModalState = 'confirm' | 'pending' | 'success' | null

function SwapPage(): ReactElement | null {
  const { address, swapTokens } = useTempo()
  const navigate = useNavigate()
  const { tokens } = useTokenList()

  const [tokenIn, setTokenIn] = useState<Token | null>(null)
  const [tokenOut, setTokenOut] = useState<Token | null>(null)
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [feeToken, setFeeToken] = useState<Token | null>(null)
  const [modalState, setModalState] = useState<ModalState>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [slippage] = useState(0.5) // 0.5% default slippage

  // Set default tokens
  useEffect(() => {
    if (tokens.length >= 2 && !tokenIn) {
      const defaultIn = tokens.find(t => t.symbol === 'AlphaUSD') || tokens[0]
      const defaultOut = tokens.find(t => t.symbol !== defaultIn.symbol) || tokens[1]
      setTokenIn(defaultIn)
      setTokenOut(defaultOut)
      setFeeToken(defaultIn)
    }
  }, [tokens, tokenIn])

  const balanceIn = useTokenBalance(tokenIn?.address as Address)
  const balanceOut = useTokenBalance(tokenOut?.address as Address)

  // Fetch quote when amount or tokens change
  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn) {
      setAmountOut('')
      return
    }

    const parsedIn = parseAmount(amountIn, tokenIn.decimals)
    if (parsedIn === 0n) {
      setAmountOut('')
      return
    }

    let cancelled = false
    setIsQuoting(true)

    const fetchQuote = async (): Promise<void> => {
      try {
        const quote = await getSwapQuote(tokenIn.address, tokenOut.address, parsedIn)
        if (!cancelled) {
          // If quote is 0, it means no liquidity
          setAmountOut(formatAmount(quote.toString(), tokenOut.decimals))
        }
      } catch (err) {
        console.error('Quote error:', err)
        if (!cancelled) {
          setAmountOut('0') // Set to '0' to indicate no liquidity
        }
      } finally {
        if (!cancelled) {
          setIsQuoting(false)
        }
      }
    }

    const debounce = setTimeout(fetchQuote, TIMING.DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
  }, [tokenIn, tokenOut, amountIn])

  const handleSwapTokens = useCallback(() => {
    const tempToken = tokenIn
    const tempAmount = amountIn
    setTokenIn(tokenOut)
    setTokenOut(tempToken)
    setAmountIn(amountOut)
    setAmountOut(tempAmount)
  }, [tokenIn, tokenOut, amountIn, amountOut])

  if (!address) return null

  const parsedAmountIn = tokenIn ? parseAmount(amountIn, tokenIn.decimals) : 0n
  const parsedAmountOut = tokenOut ? parseAmount(amountOut, tokenOut.decimals) : 0n
  const hasBalance = balanceIn.data?.value && balanceIn.data.value >= parsedAmountIn
  const minAmountOut = parsedAmountOut - (parsedAmountOut * BigInt(Math.floor(slippage * 100))) / 10000n

  // Check if there's no liquidity (quote returned 0 but we have input)
  const noLiquidity = amountIn && parsedAmountIn > 0n && !isQuoting && amountOut === '0.00'

  const isValidForm =
    tokenIn &&
    tokenOut &&
    parsedAmountIn > 0n &&
    parsedAmountOut > 0n &&
    hasBalance &&
    feeToken &&
    tokenIn.address !== tokenOut.address &&
    !noLiquidity

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !tokenIn || !tokenOut || !feeToken) return
    setModalState('pending')
    try {
      const hash = await swapTokens({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
        minAmountOut,
        feeToken: feeToken.address,
      })
      setTxHash(hash)
      setModalState('success')
      toast.success('Swap completed!', {
        description: `Swapped ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol}`,
      })
    } catch (err) {
      console.error(err)
      // Check for InsufficientLiquidity error (0x13be252b)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('0x13be252b') || errorMessage.includes('InsufficientLiquidity')) {
        toast.error('No liquidity available', {
          description: 'This trading pair has no liquidity on testnet',
        })
      } else {
        toast.error('Swap failed', {
          description: 'Please try again or contact support',
        })
      }
      setModalState(null)
    }
  }

  const resetForm = (): void => {
    setAmountIn('')
    setAmountOut('')
    setTxHash(null)
    setModalState(null)
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
        <h1 className="text-[15px] font-medium text-foreground">Swap</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-5 space-y-4">
        {/* Token In Section */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">You Pay</span>
            <button
              onClick={() => {
                if (balanceIn.data?.value && tokenIn) {
                  setAmountIn(formatAmount(balanceIn.data.value.toString(), tokenIn.decimals))
                }
              }}
              className="text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Balance: {balanceIn.isLoading ? '...' : formatAmount(balanceIn.data?.value.toString() || '0', tokenIn?.decimals)}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountIn}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                if (val.split('.').length <= 2) setAmountIn(val)
              }}
              className="flex-1 text-2xl font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            />

            {/* Token Selector */}
            <Select
              value={tokenIn?.address}
              onValueChange={(value) => {
                const token = tokens.find(t => t.address === value)
                if (token) {
                  if (token.address === tokenOut?.address) {
                    setTokenOut(tokenIn)
                  }
                  setTokenIn(token)
                }
              }}
            >
              <SelectTrigger className="w-auto h-9 min-w-[110px] bg-white shadow-sm border-gray-200">
                {tokenIn && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getTokenColors(tokenIn.symbol).bg }}
                    >
                      <DollarSign className="h-3 w-3" style={{ color: getTokenColors(tokenIn.symbol).text }} />
                    </div>
                    <span className="text-[13px] font-medium">{tokenIn.symbol}</span>
                  </div>
                )}
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(token.symbol).bg }}
                      >
                        <DollarSign className="h-3 w-3" style={{ color: getTokenColors(token.symbol).text }} />
                      </div>
                      {token.symbol}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {amountIn && parsedAmountIn > 0n && !hasBalance && (
            <p className="text-[11px] text-destructive mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Insufficient balance
            </p>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="w-10 h-10 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Token Out Section */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">You Receive</span>
            <span className="text-[11px] text-muted-foreground">
              Balance: {balanceOut.isLoading ? '...' : formatAmount(balanceOut.data?.value.toString() || '0', tokenOut?.decimals)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              {isQuoting ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              ) : (
                <span className={cn(
                  "text-2xl font-medium",
                  amountOut ? "text-foreground" : "text-muted-foreground/40"
                )}>
                  {amountOut || '0'}
                </span>
              )}
            </div>

            {/* Token Selector */}
            <Select
              value={tokenOut?.address}
              onValueChange={(value) => {
                const token = tokens.find(t => t.address === value)
                if (token) {
                  if (token.address === tokenIn?.address) {
                    setTokenIn(tokenOut)
                  }
                  setTokenOut(token)
                }
              }}
            >
              <SelectTrigger className="w-auto h-9 min-w-[110px] bg-white shadow-sm border-gray-200">
                {tokenOut && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getTokenColors(tokenOut.symbol).bg }}
                    >
                      <DollarSign className="h-3 w-3" style={{ color: getTokenColors(tokenOut.symbol).text }} />
                    </div>
                    <span className="text-[13px] font-medium">{tokenOut.symbol}</span>
                  </div>
                )}
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getTokenColors(token.symbol).bg }}
                      >
                        <DollarSign className="h-3 w-3" style={{ color: getTokenColors(token.symbol).text }} />
                      </div>
                      {token.symbol}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* No Liquidity Warning */}
          {noLiquidity && (
            <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No liquidity available for this pair on testnet
            </p>
          )}
        </div>

        {/* Rate Info */}
        {tokenIn && tokenOut && parsedAmountIn > 0n && parsedAmountOut > 0n && !noLiquidity && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Rate</span>
              <span className="text-foreground">
                1 {tokenIn.symbol} = {(Number(amountOut) / Number(amountIn)).toFixed(4)} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Slippage</span>
              <span className="text-foreground">{slippage}%</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Min. received</span>
              <span className="text-foreground">
                {formatAmount(minAmountOut.toString(), tokenOut.decimals)} {tokenOut.symbol}
              </span>
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
          disabled={!isValidForm || isQuoting}
          onClick={() => setModalState('confirm')}
        >
          {isQuoting ? 'Getting quote...' : noLiquidity ? 'No Liquidity' : 'Review Swap'}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent hideClose={modalState === 'pending'} className="sm:max-w-sm p-0 overflow-hidden">
          {modalState === 'confirm' && tokenIn && tokenOut && (
            <div className="p-5">
              <DialogTitle className="sr-only">Confirm Swap</DialogTitle>
              <DialogDescription className="sr-only">Confirm your swap</DialogDescription>

              <div className="text-center mb-5">
                <p className="text-[13px] text-muted-foreground mb-1">Swap</p>
                <p className="text-2xl font-semibold text-foreground">
                  {amountIn} <span className="text-muted-foreground font-normal">{tokenIn.symbol}</span>
                </p>
                <ArrowUpDown className="h-4 w-4 text-muted-foreground mx-auto my-2" />
                <p className="text-2xl font-semibold text-foreground">
                  {amountOut} <span className="text-muted-foreground font-normal">{tokenOut.symbol}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2.5 mb-5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-foreground">
                    1 {tokenIn.symbol} = {(Number(amountOut) / Number(amountIn)).toFixed(4)} {tokenOut.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Min. received</span>
                  <span className="text-foreground">
                    {formatAmount(minAmountOut.toString(), tokenOut.decimals)} {tokenOut.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-success">&lt;$0.001 <span className="text-muted-foreground">({feeToken?.symbol})</span></span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setModalState(null)}>
                  Cancel
                </Button>
                <Button className="flex-1 h-10" onClick={handleSubmit}>
                  Confirm Swap
                </Button>
              </div>
            </div>
          )}

          {modalState === 'pending' && tokenIn && tokenOut && (
            <div className="p-8 text-center">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing swap</DialogDescription>

              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-[14px] text-muted-foreground">
                Swapping {amountIn} {tokenIn.symbol} for {tokenOut.symbol}
              </p>
            </div>
          )}

          {modalState === 'success' && txHash && tokenIn && tokenOut && (
            <div className="p-5 text-center">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Swap completed</DialogDescription>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-6 w-6 text-success" />
              </motion.div>

              <p className="text-[15px] font-semibold text-foreground mb-0.5">Swap Completed</p>
              <p className="text-[13px] text-muted-foreground mb-4">
                {amountIn} {tokenIn.symbol} for {amountOut} {tokenOut.symbol}
              </p>

              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Transaction</p>
                <p className="font-mono text-[11px] text-foreground break-all">{txHash}</p>
              </div>

              <div className="flex gap-2">
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
                <Button className="flex-1 h-10" onClick={resetForm}>
                  Swap Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
