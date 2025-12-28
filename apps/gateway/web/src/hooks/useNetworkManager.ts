/**
 * Network Manager Hook
 * Handles network switching for external wallets (MetaMask, etc.)
 */

import { useCallback } from 'react';
import { useSwitchChain, useChainId, useAccount } from 'wagmi';
import { tempoChain } from '@/lib/tempo-client';

interface UseNetworkManagerReturn {
  /** Current chain ID (undefined if not connected) */
  chainId: number | undefined;
  /** True if connected to a chain other than Tempo */
  isWrongNetwork: boolean;
  /** True if using an injected wallet (external, not passkey) */
  isExternalWallet: boolean;
  /** Switch to Tempo network (handles add network if needed) */
  switchToTempo: () => Promise<void>;
  /** True while network switch is in progress */
  isNetworkSwitching: boolean;
  /** Error from network switch attempt */
  error: Error | null;
}

/**
 * Hook for managing network state with external wallets
 *
 * Provides:
 * - Detection of wrong network
 * - Network switching with automatic chain addition
 * - Loading and error states
 */
export function useNetworkManager(): UseNetworkManagerReturn {
  const chainId = useChainId();
  const { connector } = useAccount();
  const { switchChainAsync, isPending, error } = useSwitchChain();

  // Check if using an external wallet (injected) vs passkey
  const isExternalWallet = connector?.type === 'injected';

  // Only show wrong network for external wallets
  // Passkey wallets are always on the correct network
  const isWrongNetwork = isExternalWallet && chainId !== undefined && chainId !== tempoChain.id;

  const switchToTempo = useCallback(async () => {
    // wagmi's switchChain automatically handles:
    // 1. wallet_switchEthereumChain first
    // 2. If chain not found (error 4902), calls wallet_addEthereumChain
    await switchChainAsync({ chainId: tempoChain.id });
  }, [switchChainAsync]);

  return {
    chainId,
    isWrongNetwork,
    isExternalWallet,
    switchToTempo,
    isNetworkSwitching: isPending,
    error: error ?? null,
  };
}
