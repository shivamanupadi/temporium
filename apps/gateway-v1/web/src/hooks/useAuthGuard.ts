import { useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isAccessTokenExpired, getAuthToken } from '@/lib/auth-storage';
import { useTempo } from './useTempo';

const CHECK_INTERVAL_MS = 30_000;

/**
 * Monitors JWT token expiration and auto-logouts.
 * Applies to injected and passkey wallets (which use JWT).
 * WalletConnect manages its own session.
 */
export function useAuthGuard(): void {
  const navigate = useNavigate();
  const { disconnect, walletType } = useTempo();

  const handleExpiredToken = useCallback(async () => {
    // Only check for wallet types that use JWT
    if (walletType === 'wallet-connect') return;
    if (!walletType) return;

    const token = getAuthToken();
    if (!token) return;

    if (isAccessTokenExpired()) {
      console.log('[AuthGuard] JWT expired, logging out...');
      await disconnect();
      navigate({ to: '/' });
    }
  }, [disconnect, navigate, walletType]);

  useEffect(() => {
    handleExpiredToken();
  }, [handleExpiredToken]);

  useEffect(() => {
    if (walletType === 'wallet-connect' || !walletType) return;

    const interval = setInterval(() => {
      handleExpiredToken();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [handleExpiredToken, walletType]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'temporium_auth' && e.newValue === null) {
        disconnect();
        navigate({ to: '/' });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [disconnect, navigate]);
}
