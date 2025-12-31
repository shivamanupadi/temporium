import type React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/portal/editor')({
  component: EditorLayout,
});

function EditorLayout(): React.ReactElement {
  return <Outlet />;
}
