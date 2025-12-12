import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactElement } from 'react';
import { useTempo } from '@/hooks/useTempo';
import { PortalHeader } from '@/components/PortalHeader';

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
});

function PortalLayout(): ReactElement | null {
  const { isConnected } = useTempo();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) {
      navigate({ to: '/' });
    }
  }, [isConnected, navigate]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader />
      <main className="pt-14 pb-6">
        <div className="mx-auto max-w-6xl px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
