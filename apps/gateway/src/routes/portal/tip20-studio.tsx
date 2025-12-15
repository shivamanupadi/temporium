import { createFileRoute, Outlet } from '@tanstack/react-router';
import type { ReactElement } from 'react';

export const Route = createFileRoute('/portal/tip20-studio')({
  component: Tip20StudioLayout,
});

function Tip20StudioLayout(): ReactElement {
  return <Outlet />;
}
