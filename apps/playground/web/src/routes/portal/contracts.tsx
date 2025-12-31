import type React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/portal/contracts')({
  component: ContractsLayout,
});

function ContractsLayout(): React.ReactElement {
  return <Outlet />;
}
