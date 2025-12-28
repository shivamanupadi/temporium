import { useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isAccessTokenExpired, getAuthToken } from '@/lib/auth-storage';
import { useTempo } from './useTempo';

const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

/**
 * Hook that monitors JWT token expiration and auto-logouts when expired.
 * Should be used in protected routes (e.g., portal layout).
 */
export function useAuthGuard(): void {
  const navigate = useNavigate();
  const { disconnect, walletType } = useTempo();

  const handleExpiredToken = useCallback(async () => {
    // Only check for injected wallets that use JWT
    // Passkey wallets don't use JWT auth
    if (walletType !== 'injected') return;

    const token = getAuthToken();
    if (!token) return; // No token means already logged out

    if (isAccessTokenExpired()) {
      console.log('[AuthGuard] JWT expired, logging out...');
      await disconnect();
      navigate({ to: '/' });
    }
  }, [disconnect, navigate, walletType]);

  // Check on mount
  useEffect(() => {
    handleExpiredToken();
  }, [handleExpiredToken]);

  // Check periodically
  useEffect(() => {
    // Only set up interval for injected wallets
    if (walletType !== 'injected') return;

    const interval = setInterval(() => {
      handleExpiredToken();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [handleExpiredToken, walletType]);

  // Listen for storage events (logout from another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'temporium_auth' && e.newValue === null) {
        console.log('[AuthGuard] Auth cleared from another tab, logging out...');
        disconnect();
        navigate({ to: '/' });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [disconnect, navigate]);
}
