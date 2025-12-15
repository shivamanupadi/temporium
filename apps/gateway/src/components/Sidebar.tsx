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
  ArrowUpDown,
  Droplets,
  Clock,
  Users,
  Coins,
  Shield,
  PanelLeftClose,
  PanelLeft,
  X,
  Zap,
  ChevronsUpDown,
} from 'lucide-react';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress, copyToClipboard, cn } from '@/lib/utils';
import { LINKS, TIMING } from '@/lib/constants';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
}

function NavItem({ to, icon, label, isCollapsed }: NavItemProps): ReactElement {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    location.pathname.startsWith(to + '/') ||
    (to === '/portal/dashboard' && location.pathname === '/portal');

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-2.5 h-9 rounded-md text-[13px] font-medium transition-all',
        isCollapsed ? 'justify-center w-8 mx-auto' : 'px-2.5',
        isActive
          ? 'text-primary font-semibold bg-primary/15'
          : 'text-slate-800 hover:text-slate-900 hover:bg-slate-100'
      )}
      title={isCollapsed ? label : undefined}
    >
      <span className="flex-shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg]">
        {icon}
      </span>
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

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
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const iconSize = 'w-4 h-4';
  const iconStroke = 1.75;

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
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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
      {/* Logo & Brand */}
      <div
        className={cn(
          'flex items-start py-4',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <div className="flex flex-col gap-2">
          <Link to="/portal/dashboard" className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
            {!collapsed && (
              <span className="text-lg font-bold text-slate-900 tracking-tight">Temporium</span>
            )}
          </Link>
          {!collapsed && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 w-fit ml-[34px]">
              <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-700">Testnet</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="hidden md:block px-2 pb-2">
          <button
            onClick={onToggleCollapse}
            className="h-8 w-full flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn('flex-1 pt-4 pb-2 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
        {/* Main Section */}
        {!collapsed && (
          <p className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Main
          </p>
        )}
        <div>
          <NavItem
            to="/portal/dashboard"
            icon={<LayoutDashboard className={iconSize} strokeWidth={iconStroke} />}
            label="Dashboard"
            isCollapsed={collapsed}
          />
        </div>

        {/* Payments Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Payments
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/portal/send"
            icon={<Send className={iconSize} strokeWidth={iconStroke} />}
            label="Send"
            isCollapsed={collapsed}
          />
          <NavItem
            to="/portal/receive"
            icon={<Download className={iconSize} strokeWidth={iconStroke} />}
            label="Receive"
            isCollapsed={collapsed}
          />
        </div>

        {/* DeFi Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            DeFi
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/portal/swap"
            icon={<ArrowUpDown className={iconSize} strokeWidth={iconStroke} />}
            label="Swap"
            isCollapsed={collapsed}
          />
          <NavItem
            to="/portal/liquidity"
            icon={<Droplets className={iconSize} strokeWidth={iconStroke} />}
            label="Liquidity"
            isCollapsed={collapsed}
          />
        </div>

        {/* Tools Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Tools
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/portal/tip20-studio"
            icon={<Coins className={iconSize} strokeWidth={iconStroke} />}
            label="TIP20 Studio"
            isCollapsed={collapsed}
          />
          <NavItem
            to="/portal/tip403-factory"
            icon={<Shield className={iconSize} strokeWidth={iconStroke} />}
            label="TIP403 Factory"
            isCollapsed={collapsed}
          />
        </div>

        {/* Manage Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Manage
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/portal/scheduled"
            icon={<Clock className={iconSize} strokeWidth={iconStroke} />}
            label="Scheduled"
            isCollapsed={collapsed}
          />
          <NavItem
            to="/portal/contacts"
            icon={<Users className={iconSize} strokeWidth={iconStroke} />}
            label="Contacts"
            isCollapsed={collapsed}
          />
        </div>
      </nav>

      {/* Wallet Profile */}
      <div
        ref={dropdownRef}
        className={cn(
          'relative p-3 border-t border-slate-200/80',
          collapsed && 'flex flex-col items-center'
        )}
      >
        {collapsed ? (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Wallet className="w-5 h-5 text-slate-600" />
          </button>
        ) : (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Wallet className="w-5 h-5 text-slate-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-900 truncate">
                {address ? formatAddress(address, 6) : 'Not connected'}
              </p>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        )}

        {/* Popover Menu */}
        {showMenu && (
          <div
            onMouseDown={e => e.stopPropagation()}
            className={cn(
              'absolute z-50 rounded-md bg-white border border-slate-200 shadow-md overflow-hidden min-w-[200px]',
              collapsed ? 'left-full bottom-0 ml-2' : 'left-3 right-3 bottom-full mb-2'
            )}
          >
            <div className="px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                Wallet
              </p>
              <p className="text-[11px] font-mono text-slate-400 break-all leading-relaxed">
                {address}
              </p>
            </div>
            <div className="p-1">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-50 rounded transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
                {copied ? 'Copied!' : 'Copy address'}
              </button>
              <a
                href={`${LINKS.explorer}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-50 rounded transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-400" />
                View on Explorer
              </a>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded transition-colors"
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
          'hidden md:flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-slate-200/80 z-40 transition-all duration-200 ease-out',
          collapsed ? 'w-[68px]' : 'w-56'
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
