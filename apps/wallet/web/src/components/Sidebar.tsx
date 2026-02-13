import { Link, useLocation } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import {
  Send,
  Download,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  LayoutDashboard,
  Wallet,
  Clock,
  Users,
  Shield,
  PanelLeftClose,
  PanelLeft,
  X,
  ChevronsUpDown,
  ChevronDown,
  Globe,
} from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress, copyToClipboard, cn } from '@/lib/utils';
import { LINKS, TIMING } from '@/lib/constants';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const navSections = [
  {
    label: 'Main',
    items: [{ to: '/wallet', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Payments',
    items: [
      { to: '/wallet/send', label: 'Send', icon: Send },
      { to: '/wallet/receive', label: 'Receive', icon: Download },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/wallet/activity', label: 'Activity', icon: Clock },
      { to: '/wallet/contacts', label: 'Contacts', icon: Users },
      { to: '/wallet/apps', label: 'Connected Apps', icon: Shield },
    ],
  },
] as const;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps): ReactElement {
  const { address, disconnect } = useTempo();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNetworkMenu(false);
      }
    }
    if (showMenu || showNetworkMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, showNetworkMenu]);

  const handleCopy = async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Expand button (collapsed) */}
      {collapsed && (
        <div className="hidden md:block px-2 pt-3 pb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
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
          <img src="/logo.png" alt="Temporium" className="w-6 h-6 rounded-md shrink-0" />
          {!collapsed && (
            <div>
              <span className="text-[15px] font-bold text-[#2D3436] tracking-tight leading-none">
                Temporium
              </span>
              <p className="text-[10px] font-medium text-[#B5B0AA] mt-0.5 leading-none">Wallet</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Network Picker */}
      <div className={`py-5 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div ref={networkDropdownRef} className="relative">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                  className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    showNetworkMenu
                      ? 'bg-[#F5F2ED] ring-1 ring-[#EDE9E3]'
                      : 'bg-[#FDFBF8] border border-[#EDE9E3] hover:border-[#DDD8D1] hover:shadow-sm'
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
              className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl border bg-[#FDFBF8] transition-all cursor-pointer ${
                showNetworkMenu ? 'border-[#DDD8D1]' : 'border-[#EDE9E3] hover:border-[#DDD8D1]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#F5F2ED] flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-[#9B9590]" />
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-semibold text-[#2D3436] leading-none">Testnet</p>
                  <p className="text-[10px] text-[#9B9590] mt-0.5 leading-none">Moderato</p>
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showNetworkMenu ? 'rotate-180 text-[#6B6560]' : 'text-[#B5B0AA]'
                }`}
              />
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
                    <p className="text-[12px] font-semibold text-[#2D3436] leading-none">Testnet</p>
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
                  item.to === '/wallet'
                    ? location.pathname === '/wallet'
                    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                const Icon = item.icon;
                const linkEl = (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center rounded-xl text-[13px] font-medium transition-all ${
                      collapsed
                        ? `justify-center py-2.5 ${isActive ? 'bg-primary/8 text-primary' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
                        : `gap-3 px-3 py-2.5 ${isActive ? 'bg-primary/8 text-primary' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436]'}`
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
        ref={dropdownRef}
        className={`relative border-t border-[#EDE9E3] ${collapsed ? 'p-2' : 'p-3'}`}
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`w-full flex items-center justify-center py-2 rounded-xl transition-all ${
                  showMenu ? 'bg-[#F5F2ED] ring-1 ring-[#EDE9E3]' : 'hover:bg-[#FAF8F5]'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
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
            onClick={() => setShowMenu(!showMenu)}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all text-left ${
              showMenu ? 'bg-[#F5F2ED] ring-1 ring-[#EDE9E3]' : 'hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#2D3436] truncate">My Wallet</p>
              <p className="text-[11px] font-mono text-[#9B9590] truncate">
                {address ? formatAddress(address, 6) : 'Not connected'}
              </p>
            </div>
            <ChevronsUpDown
              className={cn(
                'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                showMenu ? 'text-[#6B6560]' : 'text-[#B5B0AA]'
              )}
            />
          </button>
        )}

        {/* Wallet Popover Menu */}
        {showMenu && (
          <div
            onMouseDown={e => e.stopPropagation()}
            className={`absolute z-50 rounded-xl bg-white border border-[#EDE9E3] shadow-xl shadow-black/8 overflow-hidden ${
              collapsed ? 'left-full bottom-0 ml-2 w-[220px]' : 'left-3 right-3 bottom-full mb-2'
            }`}
          >
            <div className="px-3.5 py-3 bg-gradient-to-b from-[#FAF8F5] to-white border-b border-[#EDE9E3]/60">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
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
                  disconnect();
                  setShowMenu(false);
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
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-[#EDE9E3]/80 z-40 transition-[width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          collapsed ? 'w-[68px]' : 'w-[220px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'md:hidden fixed left-0 top-0 h-screen w-72 bg-white z-50 transform transition-transform duration-300 ease-out shadow-xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
