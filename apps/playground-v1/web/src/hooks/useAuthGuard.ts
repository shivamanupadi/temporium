import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAccount } from 'wagmi';
import { isAccessTokenExpired, clearAuthTokens } from '@/lib/auth-storage';

export function useAuthGuard() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) {
      navigate({ to: '/' });
      return;
    }

    // Auto-logout on token expiry
    const interval = setInterval(() => {
      if (isAccessTokenExpired()) {
        clearAuthTokens();
        navigate({ to: '/' });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, navigate]);

  return { isAuthenticated: isConnected && !isAccessTokenExpired() };
}
