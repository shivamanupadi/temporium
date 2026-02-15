import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/layout/Header';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-[#FDFBF8]">
      <Header />
      <Outlet />
    </div>
  ),
});
