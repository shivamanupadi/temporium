import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactElement } from 'react';
import { useTempo } from '@/hooks/useTempo';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
});

// Persist collapsed state in localStorage
const SIDEBAR_COLLAPSED_KEY = 'temporium-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return stored === 'true';
}

function PortalLayout(): ReactElement | null {
  const { isConnected } = useTempo();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  // Auto-logout when JWT expires (for injected wallets)
  useAuthGuard();

  useEffect(() => {
    if (!isConnected) {
      navigate({ to: '/' });
    }
  }, [isConnected, navigate]);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  if (!isConnected) return null;

  return (
    <>
      {/* Wrong Network Banner - shown when external wallet is on wrong chain */}
      <WrongNetworkBanner />

      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />

        {/* Main Content */}
        <main
          className={cn(
            'min-h-screen transition-[margin] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
            collapsed ? 'md:ml-[68px]' : 'md:ml-56'
          )}
        >
          {/* Mobile Header */}
          <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <div className="p-4 sm:p-6">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
