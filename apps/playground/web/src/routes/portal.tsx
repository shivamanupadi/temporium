import type React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/Header';

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
});

function PortalLayout(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
