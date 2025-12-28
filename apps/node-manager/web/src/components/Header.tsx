import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import {
  LogOut,
  LayoutDashboard,
  ScrollText,
  Settings,
  Zap,
  ArrowUpCircle,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}

function NavItem({ to, icon, label, exact }: NavItemProps): ReactElement {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      className={cn(
        'relative flex items-center gap-2 px-3 h-14 text-[13px] font-medium transition-colors',
        isActive ? 'text-[#7c5cff]' : 'text-slate-600 hover:text-slate-900'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
      {isActive && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#7c5cff]" />}
    </Link>
  );
}

interface HeaderProps {
  currentVersion?: string;
  updateAvailable?: boolean;
  latestVersion?: string;
  onShowUpdateDialog?: () => void;
}

export function Header({
  currentVersion = '0.0.0',
  updateAvailable = false,
  latestVersion,
  onShowUpdateDialog,
}: HeaderProps): ReactElement {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = (): void => {
    logout();
    navigate({ to: '/login' });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const iconSize = 'w-4 h-4';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo & Nav */}
          <div className="flex items-center gap-4 sm:gap-8 md:gap-12 lg:gap-24">
            {/* Logo */}
            <Link to="/portal/dashboard" className="flex items-center gap-2 shrink-0">
              <Zap className="w-5 h-5 text-slate-900" strokeWidth={2} />
              <span className="text-[15px] font-semibold text-slate-900">
                Temporium
                <span className="text-slate-400 font-normal hidden md:inline"> | Node Manager</span>
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              <NavItem
                to="/portal/dashboard"
                icon={<LayoutDashboard className={iconSize} />}
                label="Dashboard"
                exact
              />
              <NavItem to="/portal/logs" icon={<ScrollText className={iconSize} />} label="Logs" />
              <NavItem
                to="/portal/settings"
                icon={<Settings className={iconSize} />}
                label="Settings"
              />
            </nav>
          </div>

          {/* Right: Update & User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Update Badge */}
            {updateAvailable && (
              <button
                onClick={onShowUpdateDialog}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] sm:text-[12px] font-medium hover:bg-emerald-100 transition-colors"
              >
                <ArrowUpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">v{latestVersion}</span>
                <span className="xs:hidden">New</span>
              </button>
            )}

            {/* User Menu */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <span className="text-[12px] sm:text-[13px] font-medium">v{currentVersion}</span>
                <ChevronDown
                  className={cn('w-3.5 h-3.5 transition-transform', showMenu && 'rotate-180')}
                />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Node Manager
                    </p>
                    <p className="text-[12px] text-slate-600 mt-0.5">Version {currentVersion}</p>
                  </div>

                  {/* Mobile Nav */}
                  <div className="sm:hidden p-1 border-b border-slate-100">
                    <Link
                      to="/portal/dashboard"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 rounded-md"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      to="/portal/logs"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 rounded-md"
                    >
                      <ScrollText className="w-4 h-4" />
                      Logs
                    </Link>
                    <Link
                      to="/portal/settings"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 rounded-md"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
