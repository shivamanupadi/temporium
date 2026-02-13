import { type ReactElement, useState, useRef, useEffect } from 'react';
import { createFileRoute, Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Send,
  QrCode,
  ArrowRightLeft,
  Droplets,
  CircleDollarSign,
  Shield,
  Key,
  Users,
  Clock,
  Link2,
  BarChart3,
  Repeat,
  LogOut,
  Menu,
  X,
  Wallet,
  Globe,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { formatAddress, copyToClipboard } from '@/lib/utils';
import { LINKS, TIMING } from '@/lib/constants';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
});

const navSections = [
  {
    label: 'Main',
    items: [{ to: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Payments',
    items: [
      { to: '/portal/send', label: 'Send', icon: Send },
      { to: '/portal/receive', label: 'Receive', icon: QrCode },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/portal/tip20-studio', label: 'TIP20 Studio', icon: CircleDollarSign },
      { to: '/portal/tip403-factory', label: 'TIP403 Factory', icon: Shield },
    ],
  },
  {
    label: 'Stablecoin DEX',
    items: [
      { to: '/portal/swap', label: 'Swap', icon: ArrowRightLeft },
      { to: '/portal/orderbook', label: 'Orderbook', icon: BarChart3 },
      { to: '/portal/exchange-balance', label: 'DEX Balance', icon: Wallet },
    ],
  },
  {
    label: 'AMM',
    items: [
      { to: '/portal/pool-swap', label: 'Pool Swap', icon: Repeat },
      { to: '/portal/liquidity', label: 'Liquidity', icon: Droplets },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/portal/scheduled', label: 'Scheduled', icon: Clock },
      { to: '/portal/access-keys', label: 'Access Keys', icon: Key },
      { to: '/portal/contacts', label: 'Contacts', icon: Users },
      { to: '/portal/connected-apps', label: 'Connected Apps', icon: Link2 },
    ],
  },
] as const;

const SIDEBAR_COLLAPSED_KEY = 'temporium-gateway-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return stored === 'true';
}

function PortalLayout(): ReactElement | null {
  const { isConnected, address, disconnect } = useTempo();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useAuthGuard();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNetworkMenu(false);
      }
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    }
    if (showNetworkMenu || showWalletMenu)
      document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNetworkMenu, showWalletMenu]);

  const handleCopy = async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#FDFBF8]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-[#EDE9E3] bg-white transition-[width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        {/* Expand button (collapsed) */}
        {collapsed && (
          <div className="px-2 pt-3 pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(false)}
                  className="h-8 w-full flex items-center justify-center rounded-lg text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Logo */}
        <div
          className={`flex items-start py-4 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}
        >
          <div className="flex items-center gap-2.5">
            <img src="/logo-dark.png" alt="Temporium" className="w-6 h-6 shrink-0" />
            {!collapsed && (
              <div>
                <span className="text-[15px] font-bold text-[#2D3436] tracking-tight leading-none">
                  Temporium
                </span>
                <p className="text-[10px] font-medium text-[#B5B0AA] mt-0.5 leading-none">
                  Gateway
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Network Picker */}
        <div className={`pb-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          <div ref={networkDropdownRef} className="relative">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                    className={`w-10 h-10 mx-auto flex items-center justify-center rounded-lg transition-all cursor-pointer bg-[#F5F2ED]/60 ${
                      showNetworkMenu ? 'ring-1 ring-[#EDE9E3] bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#9B9590]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Tempo Testnet
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg transition-all cursor-pointer bg-[#F5F2ED]/60 ${
                  showNetworkMenu ? 'ring-1 ring-[#EDE9E3] bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#F5F2ED] flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-[#9B9590]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-[#2D3436] leading-none">Testnet</p>
                    <p className="text-[11px] text-[#9B9590] mt-0.5 leading-none">Moderato</p>
                  </div>
                </div>
                <ChevronsUpDown className="w-3 h-3 text-[#B5B0AA]" />
              </button>
            )}

            {/* Network Dropdown */}
            {showNetworkMenu && (
              <div
                onMouseDown={e => e.stopPropagation()}
                className={`absolute z-50 top-full mt-2 rounded-xl bg-white border border-[#EDE9E3] shadow-xl shadow-black/8 overflow-hidden ${
                  collapsed ? 'left-full ml-2 top-0 mt-0 min-w-[220px]' : 'left-0 right-0'
                }`}
              >
                <div className="px-2 pt-2.5 pb-1">
                  <p className="px-2 pb-2 text-[10px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Network
                  </p>
                  <button
                    onClick={() => setShowNetworkMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] bg-[#5B9A6F]/[0.06] rounded-lg ring-1 ring-[#5B9A6F]/15 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#5B9A6F]/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-3.5 h-3.5 text-[#5B9A6F]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-semibold text-[#2D3436] leading-none">
                        Testnet
                      </p>
                      <p className="text-[10px] text-[#9B9590] mt-1 leading-none">Moderato</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-[#5B9A6F]/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-[#5B9A6F]" strokeWidth={2.5} />
                    </div>
                  </button>
                </div>
                <div className="mx-2 border-t border-[#EDE9E3]/60" />
                <div className="px-2 py-1.5">
                  <button
                    disabled
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-lg cursor-not-allowed opacity-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#EDE9E3]/60 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-3.5 h-3.5 text-[#B5B0AA]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-medium text-[#6B6560] leading-none">Mainnet</p>
                      <p className="text-[10px] text-[#9B9590] mt-1 leading-none">Coming soon</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold uppercase tracking-wide flex-shrink-0">
                      Soon
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {navSections.map((section, sectionIdx) => (
            <div key={section.label}>
              {!collapsed ? (
                <p
                  className={`px-3 pb-1 text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-wider ${sectionIdx === 0 ? 'pt-0.5' : 'pt-3'}`}
                >
                  {section.label}
                </p>
              ) : (
                sectionIdx > 0 && <div className="my-1.5 mx-1 border-t border-[#EDE9E3]" />
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive =
                    location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  const linkEl = (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center rounded-xl text-[13px] font-medium transition-all ${
                        collapsed
                          ? `justify-center py-2 ${isActive ? 'bg-[#E07A5F]/8 text-[#E07A5F]' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
                          : `gap-3 px-3 py-1.5 ${isActive ? 'bg-[#E07A5F]/8 text-[#E07A5F]' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && item.label}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkEl
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Wallet Profile Footer */}
        <div
          ref={walletDropdownRef}
          className={`relative border-t border-[#EDE9E3] ${collapsed ? 'p-2' : 'p-3'}`}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className={`w-full flex items-center justify-center py-2 rounded-xl transition-all bg-[#FAF8F5] ${
                    showWalletMenu ? 'ring-1 ring-[#EDE9E3] bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#E07A5F] flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {address ? formatAddress(address, 6) : 'My Wallet'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all text-left bg-[#FAF8F5] ${
                showWalletMenu ? 'ring-1 ring-[#EDE9E3] bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#E07A5F] flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#2D3436] truncate">My Wallet</p>
                <p className="text-[11px] font-mono text-[#9B9590] truncate">
                  {address ? formatAddress(address, 6) : 'Not connected'}
                </p>
              </div>
              <ChevronsUpDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  showWalletMenu ? 'text-[#6B6560]' : 'text-[#B5B0AA]'
                }`}
              />
            </button>
          )}

          {/* Wallet Popover Menu */}
          {showWalletMenu && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className={`absolute z-50 bottom-full mb-2 rounded-xl bg-white border border-[#EDE9E3] shadow-xl shadow-black/8 overflow-hidden ${
                collapsed ? 'left-2 w-[220px]' : 'left-3 right-3'
              }`}
            >
              <div className="px-3.5 py-3 bg-gradient-to-b from-[#FAF8F5] to-white border-b border-[#EDE9E3]/60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[#E07A5F] flex items-center justify-center">
                    <Wallet className="w-3 h-3 text-white" strokeWidth={2} />
                  </div>
                  <p className="text-[12px] font-semibold text-[#2D3436]">My Wallet</p>
                </div>
                <p className="text-[10.5px] font-mono text-[#9B9590] break-all leading-relaxed bg-[#F5F2ED]/60 rounded-lg px-2.5 py-1.5">
                  {address}
                </p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#4D5456] hover:bg-[#FAF8F5] rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[#5B9A6F]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#9B9590]" />
                  )}
                  {copied ? 'Copied!' : 'Copy address'}
                </button>
                <a
                  href={`${LINKS.explorer}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#4D5456] hover:bg-[#FAF8F5] rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[#9B9590]" />
                  View on Explorer
                </a>
                <div className="my-1 mx-2 border-t border-[#EDE9E3]/60" />
                <button
                  onClick={() => {
                    setShowWalletMenu(false);
                    disconnect().then(() => navigate({ to: '/' }));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#EDE9E3] bg-white">
          <div className="flex items-center gap-2.5">
            <img src="/logo-dark.png" alt="Temporium" className="w-6 h-6" />
            <span className="text-[14px] font-bold text-[#2D3436]">Temporium</span>
            <span className="text-[14px] font-medium text-[#B5B0AA]">| Gateway</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 rounded-lg border border-[#EDE9E3] flex items-center justify-center hover:bg-[#F5F2ED] transition-colors"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </header>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden border-b border-[#EDE9E3] bg-white overflow-hidden"
            >
              <nav className="p-3 space-y-0.5">
                {/* Mobile Network Info */}
                <div className="flex items-center gap-2.5 px-3 py-2 mb-2 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8]">
                  <div className="w-6 h-6 rounded-lg bg-[#F5F2ED] flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-[#9B9590]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#2D3436] leading-none">Testnet</p>
                    <p className="text-[10px] text-[#9B9590] mt-0.5 leading-none">Moderato</p>
                  </div>
                </div>

                {navSections.map((section, sectionIdx) => (
                  <div key={section.label}>
                    <p
                      className={`px-3 pb-1 text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-wider ${sectionIdx === 0 ? 'pt-1' : 'pt-4'}`}
                    >
                      {section.label}
                    </p>
                    {section.items.map(item => {
                      const isActive = location.pathname === item.to;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                            isActive
                              ? 'bg-[#E07A5F]/8 text-[#E07A5F]'
                              : 'text-[#6B6560] hover:bg-[#F5F2ED]'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                        </Link>
                      );
                    })}
                  </div>
                ))}
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await disconnect();
                    navigate({ to: '/' });
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
