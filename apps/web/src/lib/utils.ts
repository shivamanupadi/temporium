import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an address for display (truncate middle)
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return ''
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format a token amount with proper decimals
 */
export function formatAmount(
  amount: string | bigint,
  decimals = 6,
  displayDecimals = 2
): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor

  const fractionStr = fraction.toString().padStart(decimals, '0')
  const displayFraction = fractionStr.slice(0, displayDecimals)

  // Format with commas
  const wholeFormatted = whole.toLocaleString()

  if (displayDecimals === 0) return wholeFormatted
  return `${wholeFormatted}.${displayFraction}`
}

/**
 * Parse a user-entered amount to bigint
 */
export function parseAmount(value: string, decimals = 6): bigint {
  if (!value || value === '.') return 0n

  // Remove commas and other formatting characters
  const cleanValue = value.replace(/,/g, '')

  const [whole = '0', fraction = ''] = cleanValue.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const combined = whole + paddedFraction

  return BigInt(combined)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Format a timestamp relative to now
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  return new Date(timestamp * 1000).toLocaleDateString()
}

/**
 * Format countdown time
 */
export function formatCountdown(targetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = targetTimestamp - now

  if (diff <= 0) return 'Now'

  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
