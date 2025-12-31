import { createFileRoute, redirect } from '@tanstack/react-router';

// Redirect /portal/editor/new to /portal/editor (use the modal instead)
export const Route = createFileRoute('/portal/editor/new')({
  beforeLoad: () => {
    throw redirect({ to: '/portal/editor' });
  },
  component: () => null,
});
