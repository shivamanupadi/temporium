import { type ReactElement, useState, useRef, useEffect } from 'react';
import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
  useNavigate,
  redirect,
} from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Send,
  QrCode,
  CircleDollarSign,
  Shield,
  Key,
  Users,
  Clock,
  LogOut,
  Settings,
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
  ListPlus,
  Gift,
  ArrowLeftRight,
  Link2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { formatAddress, copyToClipboard } from '@/lib/utils';
import { LINKS, TIMING, TEMPO_NETWORK, isTestnet, switchNetwork } from '@/lib/constants';
import { isAccessTokenExpired, clearAuthToken } from '@/lib/auth-storage';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ReceiveModal } from '@/components/ReceiveModal';

export const Route = createFileRoute('/portal')({
  beforeLoad: async () => {
    if (await isAccessTokenExpired()) {
      await clearAuthToken();
      throw redirect({ to: '/' });
    }
  },
  component: PortalLayout,
});

const navSections = [
  {
    label: 'Main',
    items: [{ to: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Transfers',
    items: [
      { to: '/portal/send', label: 'Send', icon: Send },
      { to: '/portal/receive', label: 'Receive', icon: QrCode },
      { to: '/portal/dex-swap', label: 'Swap', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Payments',
    items: [
      { to: '/portal/payment-links', label: 'Payment Links', icon: Link2 },
      { to: '/portal/batch-payments', label: 'Batch Payments', icon: ListPlus },
      { to: '/portal/scheduled-payments', label: 'Scheduled Payments', icon: Clock },
    ],
  },
  {
    label: 'TIP20 Manager',
    items: [
      { to: '/portal/tip20-studio', label: 'TIP20 Studio', icon: CircleDollarSign },
      { to: '/portal/rewards', label: 'TIP20 Rewards', icon: Gift },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/portal/tip403-factory', label: 'TIP403 Factory', icon: Shield },
      { to: '/portal/access-keys', label: 'Access Keys', icon: Key },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/portal/contacts', label: 'Contacts', icon: Users },
      { to: '/portal/settings', label: 'Settings', icon: Settings },
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
  const { isConnected, address, disconnect, walletType } = useTempo();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [pendingNetworkSwitch, setPendingNetworkSwitch] = useState<string | null>(null);
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

  const [tokenExpired, setTokenExpired] = useState(false);

  useEffect(() => {
    isAccessTokenExpired().then(setTokenExpired);
  }, []);

  const shouldRedirect = !isConnected || tokenExpired;

  useEffect(() => {
    if (shouldRedirect) {
      navigate({ to: '/' });
    }
  }, [shouldRedirect, navigate]);

  if (shouldRedirect) {
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
            <img src="/logo-dark.png" alt="Temporium" className="w-6 h-6 shrink-0 rounded-full" />
            {!collapsed && (
              <span className="text-[15px] font-bold text-[#2D3436] tracking-tight leading-none">
                Temporium
              </span>
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
                    className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-white border border-[#EDE9E3] hover:border-[#D5D0C9] transition-all shadow-sm"
                  >
                    <Globe
                      className={`w-4 h-4 ${isTestnet ? 'text-[#E07A5F]' : 'text-[#6B8F71]'}`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {isTestnet ? 'Tempo Testnet' : 'Tempo Mainnet'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white border border-[#EDE9E3] hover:border-[#D5D0C9] transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Globe
                    className={`w-4 h-4 flex-shrink-0 ${isTestnet ? 'text-[#E07A5F]' : 'text-[#6B8F71]'}`}
                  />
                  <span className="text-[13px] font-semibold text-[#2D3436] leading-none">
                    {isTestnet ? 'Testnet' : 'Mainnet'}
                  </span>
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
                  <p className="px-2 pb-2 text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Network
                  </p>
                  {[
                    {
                      id: 'testnet' as const,
                      label: 'Testnet',
                      sublabel: 'Moderato',
                      color: '#E07A5F',
                    },
                    {
                      id: 'mainnet' as const,
                      label: 'Mainnet',
                      sublabel: 'Presto',
                      color: '#6B8F71',
                    },
                  ].map((net, idx) => {
                    const isActive = TEMPO_NETWORK === net.id;
                    return (
                      <div key={net.id}>
                        {idx > 0 && <div className="mx-1 my-1 border-t border-[#EDE9E3]/60" />}
                        <button
                          onClick={() => {
                            if (isActive) {
                              setShowNetworkMenu(false);
                            } else if (walletType === 'tempo') {
                              setShowNetworkMenu(false);
                              setPendingNetworkSwitch(net.id);
                            } else {
                              switchNetwork(net.id);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-lg cursor-pointer hover:bg-[#F5F2ED]"
                          style={
                            isActive
                              ? {
                                  backgroundColor: `${net.color}0F`,
                                  boxShadow: `inset 0 0 0 1px ${net.color}26`,
                                }
                              : undefined
                          }
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${net.color}1A` }}
                          >
                            <Globe className="w-3.5 h-3.5" style={{ color: net.color }} />
                          </div>
                          <div className="flex-1 text-left">
                            <p
                              className={`text-[13px] leading-none ${isActive ? 'font-semibold text-[#2D3436]' : 'font-medium text-[#6B6560]'}`}
                            >
                              {net.label}
                            </p>
                            <p className="text-[11px] text-[#9B9590] mt-1 leading-none">
                              {net.sublabel}
                            </p>
                          </div>
                          {isActive && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${net.color}1A` }}
                            >
                              <Check
                                className="w-3 h-3"
                                style={{ color: net.color }}
                                strokeWidth={2.5}
                              />
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
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
                          ? `justify-center py-2 ${isActive ? 'bg-[#F5F2ED] text-[#2D3436]' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
                          : `gap-3 px-3 py-1.5 ${isActive ? 'bg-[#F5F2ED] text-[#2D3436]' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#E07A5F]' : ''}`} />
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
                  <div className="w-8 h-8 rounded-full bg-[#6B8F71] flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {address ? formatAddress(address, 6) : 'My Wallet'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              className={`flex items-center rounded-xl transition-all bg-[#FAF8F5] ${
                showWalletMenu ? 'ring-1 ring-[#EDE9E3] bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]'
              }`}
            >
              <div className="flex items-center gap-3 px-2.5 py-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#6B8F71] flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#2D3436] truncate">My Wallet</p>
                  <p className="text-[11px] font-mono text-[#9B9590] truncate">
                    {address ? formatAddress(address, 6) : 'Not connected'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#B5B0AA] hover:text-[#6B6560] hover:bg-[#EDE9E3]/60 transition-colors flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#6B8F71]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setShowWalletMenu(!showWalletMenu)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#B5B0AA] hover:text-[#6B6560] hover:bg-[#EDE9E3]/60 transition-colors flex-shrink-0 mr-1"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Wallet Popover Menu */}
          {showWalletMenu && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className={`absolute z-50 bottom-full mb-2 rounded-xl bg-white border border-[#EDE9E3] shadow-xl shadow-black/8 overflow-hidden ${
                collapsed ? 'left-2 w-[220px]' : 'left-3 right-3'
              }`}
            >
              <div className="px-3.5 py-3 border-b border-[#EDE9E3]/60">
                <p className="text-[12px] font-semibold text-[#2D3436] mb-1.5">My Wallet</p>
                <p className="text-[10.5px] font-mono text-[#9B9590] break-all leading-relaxed">
                  {address}
                </p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#4D5456] hover:bg-[#FAF8F5] rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[#6B8F71]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#9B9590]" />
                  )}
                  {copied ? 'Copied!' : 'Copy address'}
                </button>
                <button
                  onClick={() => {
                    setShowWalletMenu(false);
                    setShowReceiveModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#4D5456] hover:bg-[#FAF8F5] rounded-lg transition-colors"
                >
                  <QrCode className="w-4 h-4 text-[#9B9590]" />
                  Receive
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#E07A5F] hover:bg-[#E07A5F]/5 rounded-lg transition-colors"
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
            <img src="/logo-dark.png" alt="Temporium" className="w-6 h-6 rounded-full" />
            <span className="text-[14px] font-bold text-[#2D3436]">Temporium</span>
            <span className="text-[14px] font-medium text-[#B5B0AA]">| Wallet</span>
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
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${isTestnet ? 'bg-[#E07A5F]/10' : 'bg-[#6B8F71]/10'}`}
                  >
                    <Globe
                      className={`w-3.5 h-3.5 ${isTestnet ? 'text-[#E07A5F]' : 'text-[#6B8F71]'}`}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#2D3436] leading-none">
                      {isTestnet ? 'Testnet' : 'Mainnet'}
                    </p>
                    <p className="text-[10px] text-[#9B9590] mt-0.5 leading-none">
                      {isTestnet ? 'Moderato' : 'Presto'}
                    </p>
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
                              ? 'bg-[#F5F2ED] text-[#2D3436]'
                              : 'text-[#6B6560] hover:bg-[#F5F2ED]'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#E07A5F]' : ''}`} />
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
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#E07A5F] hover:bg-[#E07A5F]/5 transition-all mt-2"
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
      {/* Mainnet Coming Soon Modal */}
      {/* Network Switch Confirmation (Tempo wallet only) */}
      <Dialog
        open={!!pendingNetworkSwitch}
        onOpenChange={open => {
          if (!open) setPendingNetworkSwitch(null);
        }}
      >
        <DialogContent className="max-w-sm p-7 rounded-2xl text-center" hideClose>
          <div className="w-12 h-12 rounded-2xl bg-[#D4A574]/10 flex items-center justify-center mx-auto mb-4">
            <Globe className="w-6 h-6 text-[#D4A574]" />
          </div>
          <DialogTitle className="text-[16px] font-bold text-[#2D3436] mb-2">
            Switch Network
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B6560] leading-relaxed mb-5">
            Switching to{' '}
            <span className="font-semibold text-[#2D3436]">
              {pendingNetworkSwitch === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </span>{' '}
            will sign you out. You&apos;ll need to connect your wallet again.
          </DialogDescription>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingNetworkSwitch(null)}
              className="flex-1 py-2.5 px-4 rounded-xl text-[13px] font-semibold border border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => switchNetwork(pendingNetworkSwitch as 'testnet' | 'mainnet', true)}
              className="flex-1 py-2.5 px-4 rounded-xl text-[13px] font-semibold bg-[#E07A5F] text-white hover:bg-[#D06A4F] transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiveModal open={showReceiveModal} onOpenChange={setShowReceiveModal} address={address} />
    </div>
  );
}
