import { createFileRoute, Outlet } from '@tanstack/react-router';
import type { ReactElement } from 'react';

export const Route = createFileRoute('/portal/stablecoins')({
  component: StablecoinsLayout,
});

function StablecoinsLayout(): ReactElement {
  return <Outlet />;
}
