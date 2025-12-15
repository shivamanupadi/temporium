import { createFileRoute, Outlet } from '@tanstack/react-router';
import type { ReactElement } from 'react';

export const Route = createFileRoute('/portal/access-keys')({
  component: AccessKeysLayout,
});

function AccessKeysLayout(): ReactElement {
  return <Outlet />;
}
