import { createFileRoute, Outlet } from '@tanstack/react-router';
import type { ReactElement } from 'react';

export const Route = createFileRoute('/portal/tip403-factory')({
  component: Tip403FactoryLayout,
});

function Tip403FactoryLayout(): ReactElement {
  return <Outlet />;
}
