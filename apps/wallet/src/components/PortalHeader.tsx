import { Link, useLocation } from '@tanstack/react-router'
import { useState, useRef, useEffect, type ReactElement } from 'react'
import { Send, Download, LogOut, Copy, Check, ExternalLink, ChevronDown, LayoutDashboard, Wallet, ArrowUpDown, Droplets, Clock, Users, Coins } from 'lucide-react'
import { useTempo } from '@/hooks/useTempo'
import { formatAddress, copyToClipboard, cn } from '@/lib/utils'
import { LINKS, TIMING } from '@/lib/constants'
import { toast } from 'sonner'

const navItems = [
  { to: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portal/send', label: 'Send', icon: Send },
  { to: '/portal/receive', label: 'Receive', icon: Download },
  { to: '/portal/swap', label: 'Swap', icon: ArrowUpDown },
  { to: '/portal/liquidity', label: 'Liquidity', icon: Droplets },
  { to: '/portal/stablecoins', label: 'Stablecoins', icon: Coins },
  { to: '/portal/contacts', label: 'Contacts', icon: Users },
  { to: '/portal/scheduled', label: 'Scheduled', icon: Clock },
]

export function PortalHeader(): ReactElement {
  const { address, disconnect } = useTempo()
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleCopy = async (): Promise<void> => {
    if (!address) return
    const success = await copyToClipboard(address)
    if (success) {
      setCopied(true)
      toast.success('Address copied')
      copyTimeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
      <div className="mx-auto max-w-6xl">
        <div className="flex h-14 items-center justify-between px-6">
          {/* Left: Logo */}
          <Link
            to="/portal/dashboard"
            className="text-[16px] font-semibold text-gray-900 tracking-tight hover:text-primary transition-colors"
          >
            Tollr
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to ||
                (item.to === '/portal/dashboard' && location.pathname === '/portal')
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'relative px-3 py-1.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gray-900 rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Testnet Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50" style={{ border: '1px solid #10b981' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-emerald-600">Testnet</span>
            </div>

            {/* Address Dropdown */}
            {address && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors',
                    showMenu
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-100/60'
                  )}
                >
                  <Wallet className="h-4 w-4 text-gray-500" />
                  <span className="font-mono text-[12px] text-gray-600">
                    {formatAddress(address, 4)}
                  </span>
                  <ChevronDown className={cn(
                    'h-3.5 w-3.5 text-gray-400 transition-transform',
                    showMenu && 'rotate-180'
                  )} />
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
                      {/* Address */}
                      <div className="p-2.5 border-b border-gray-50">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                          Wallet
                        </p>
                        <div className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded truncate">
                          {address}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-1.5">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-left text-[12px] text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-gray-400" />
                          )}
                          {copied ? 'Copied!' : 'Copy address'}
                        </button>

                        <a
                          href={`${LINKS.explorer}/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-left text-[12px] text-gray-600 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowMenu(false)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                          View on Explorer
                        </a>

                        <div className="my-1 mx-2.5 border-t border-gray-100" />

                        <button
                          onClick={() => {
                            setShowMenu(false)
                            disconnect()
                          }}
                          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-left text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign out
                        </button>
                      </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden border-t border-gray-100/80 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-around py-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors rounded-md',
                  isActive ? 'text-primary' : 'text-gray-400'
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
