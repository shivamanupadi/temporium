import type React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

export const Route = createFileRoute('/editor')({
  component: EditorLayout,
});

function EditorLayout(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
