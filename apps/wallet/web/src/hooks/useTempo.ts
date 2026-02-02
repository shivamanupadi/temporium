import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi';
import { type Address } from 'viem';
import { tempoPasskeyConnector, injectedConnector } from '@/lib/wagmi';
import { tempoChain } from '@/lib/tempo-client';
import { clearAuthToken } from '@/lib/auth-storage';

/** Type of wallet connection */
export type WalletType = 'passkey' | 'injected' | null;

interface UseTempoReturn {
  isConnected: boolean;
  isConnecting: boolean;
  address: Address | undefined;
  error: Error | null;
  /** Type of current wallet connection */
  walletType: WalletType;
  /** True if an injected wallet (MetaMask, etc.) is available */
  hasInjectedWallet: boolean;
  signUp: (label?: string) => Promise<void>;
  signIn: () => Promise<void>;
  /** Connect with an injected wallet (MetaMask, etc.) */
  connectInjected: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Main Tempo hook for wallet app - wraps tempo.ts functionality
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   address,
 *   signUp,
 *   signIn,
 * } = useTempo()
 * ```
 */
export function useTempo(): UseTempoReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wagmi hooks
  const { address, isConnected, connector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const connectors = useConnectors();

  // Detect if user has an injected wallet available
  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  // Determine wallet type based on current connector
  const walletType: WalletType = isConnected
    ? connector?.type === 'injected'
      ? 'injected'
      : 'passkey'
    : null;

  /**
   * Sign up with a new passkey (creates wallet)
   * @param label - Optional label for the passkey (will be prefixed with "Temporium: ")
   */
  const signUp = useCallback(
    async (label?: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        // Generate passkey label with Temporium prefix
        const passkeyLabel = label ? `Temporium: ${label}` : 'Temporium Wallet';

        // Pass capabilities through wagmi connect - tempo.ts connector handles this
        await connectAsync({
          connector: tempoPasskeyConnector,
          capabilities: { type: 'sign-up', label: passkeyLabel },
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectAsync]
  );

  /**
   * Sign in with existing passkey
   */
  const signIn = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // Pass capabilities through wagmi connect - tempo.ts connector handles this
      await connectAsync({
        connector: tempoPasskeyConnector,
        capabilities: { type: 'sign-in', selectAccount: true },
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync]);

  /**
   * Connect with an injected wallet (MetaMask, Brave, etc.)
   */
  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // Connect wallet (switches/adds network automatically)
      await connectAsync({
        connector: injectedConnector,
        chainId: tempoChain.id,
      });
    } catch (err) {
      setError(err as Error);
      // If connection fails, disconnect
      try {
        await disconnectAsync();
      } catch {
        // Ignore disconnect errors
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    // Clear any auth tokens
    clearAuthToken();
    // Disconnect wallet
    await disconnectAsync();
  }, [disconnectAsync]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    address,
    error,
    walletType,
    hasInjectedWallet,

    // Auth actions
    signUp,
    signIn,
    connectInjected,
    disconnect,
  };
}
