import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import {
  LogOut,
  Server,
  ScrollText,
  Download,
  Settings,
  PanelLeftClose,
  PanelLeft,
  X,
  Zap,
  ChevronsUpDown,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  exact?: boolean;
}

function NavItem({ to, icon, label, isCollapsed, exact }: NavItemProps): ReactElement {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-2.5 h-8 rounded-md text-[14px] font-medium transition-all',
        isCollapsed ? 'justify-center w-8 mx-auto' : 'px-2.5',
        isActive
          ? 'font-semibold bg-[#f2f2f2]'
          : 'text-slate-800 hover:text-slate-900 hover:bg-slate-100'
      )}
      title={isCollapsed ? label : undefined}
    >
      <span
        className={cn(
          'flex-shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg]',
          isActive ? 'text-[#6b4dee]' : ''
        )}
      >
        {icon}
      </span>
      {!isCollapsed && <span className={isActive ? 'text-black' : ''}>{label}</span>}
    </Link>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentVersion?: string;
  updateAvailable?: boolean;
  latestVersion?: string;
  onCheckUpdate?: () => void;
  onShowUpdateDialog?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
  currentVersion = '0.0.0',
  updateAvailable = false,
  latestVersion,
  onCheckUpdate,
  onShowUpdateDialog,
}: SidebarProps): ReactElement {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = (): void => {
    logout();
    navigate({ to: '/login' });
  };

  const iconSize = 'w-4 h-4';
  const iconStroke = 1.75;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Logo & Brand */}
      <div
        className={cn(
          'flex items-start py-4',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
          {!collapsed && (
            <span className="text-lg font-bold text-slate-900 tracking-tight">Temporium</span>
          )}
        </Link>
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
        {/* Node Section */}
        {!collapsed && (
          <p className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Node
          </p>
        )}
        <div>
          <NavItem
            to="/dashboard"
            icon={<Server className={iconSize} strokeWidth={iconStroke} />}
            label="Overview"
            isCollapsed={collapsed}
            exact
          />
          <NavItem
            to="/dashboard/logs"
            icon={<ScrollText className={iconSize} strokeWidth={iconStroke} />}
            label="Logs"
            isCollapsed={collapsed}
          />
        </div>

        {/* Data Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Data
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/dashboard/snapshots"
            icon={<Download className={iconSize} strokeWidth={iconStroke} />}
            label="Snapshots"
            isCollapsed={collapsed}
          />
        </div>

        {/* System Section */}
        {!collapsed && (
          <p className="px-3 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            System
          </p>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-slate-100" />}
        <div>
          <NavItem
            to="/dashboard/settings"
            icon={<Settings className={iconSize} strokeWidth={iconStroke} />}
            label="Settings"
            isCollapsed={collapsed}
          />
        </div>
      </nav>

      {/* Update Banner */}
      {updateAvailable && !collapsed && (
        <div className="px-3 pb-3">
          <button
            onClick={onShowUpdateDialog}
            className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium">Update Available</p>
              <p className="text-[10px] opacity-75">v{latestVersion}</p>
            </div>
          </button>
        </div>
      )}

      {/* Version Info */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between px-2.5 text-[11px] text-slate-400">
            <span>v{currentVersion}</span>
            {onCheckUpdate && (
              <button
                onClick={onCheckUpdate}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                title="Check for updates"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* User Menu */}
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
            <Server className="w-5 h-5 text-slate-600" />
          </button>
        ) : (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Server className="w-5 h-5 text-slate-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-900 truncate">Node Manager</p>
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
                Tempo Node Manager
              </p>
              <p className="text-[11px] text-slate-500">v{currentVersion}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
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
