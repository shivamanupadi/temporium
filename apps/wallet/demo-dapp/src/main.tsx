import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { GatewayProvider } from '@/context/GatewayContext';
import { routeTree } from './routeTree.gen';
import '@/styles/index.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GatewayProvider>
      <RouterProvider router={router} />
    </GatewayProvider>
  </React.StrictMode>
);
