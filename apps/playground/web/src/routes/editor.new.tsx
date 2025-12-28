import { createFileRoute, redirect } from '@tanstack/react-router';

// Redirect /editor/new to /editor (use the modal instead)
export const Route = createFileRoute('/editor/new')({
  beforeLoad: () => {
    throw redirect({ to: '/editor' });
  },
  component: () => null,
});
