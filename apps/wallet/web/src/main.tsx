import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';
import { Toaster } from '@/components/ui/toaster';
import { ApiClientError } from '@/lib/api-client';
import { clearAuthTokens } from '@/lib/auth-storage';
import { routeTree } from './routeTree.gen';
import '@/styles/index.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

let isLoggingOut = false;

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: error => {
      if (error instanceof ApiClientError && error.status === 401 && !isLoggingOut) {
        isLoggingOut = true;
        void clearAuthTokens();
        queryClient.clear();
        router.navigate({ to: '/' });
        isLoggingOut = false;
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
