import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useConnectors } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQueryClient } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';
import { tempoPasskeyConnector, injectedConnector, wagmiConfig } from '@/lib/wagmi';
import { tempoChain, waitForTx } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import { clearAuthTokens } from '@/lib/auth-storage';
import { signInWithEthereum } from '@/lib/siwe-auth';

export type WalletType = 'passkey' | 'injected' | null;

interface DeployContractParams {
  abi: Abi;
  bytecode: `0x${string}`;
  args?: unknown[];
}

interface DeployResult {
  address: Address;
  txHash: string;
}

interface UseTempoReturn {
  isConnected: boolean;
  isConnecting: boolean;
  address: Address | undefined;
  error: Error | null;
  walletType: WalletType;
  hasInjectedWallet: boolean;
  signUp: (label?: string) => Promise<void>;
  signIn: () => Promise<void>;
  connectInjected: () => Promise<void>;
  disconnect: () => Promise<void>;
  deployContract: (params: DeployContractParams) => Promise<DeployResult>;
}

export function useTempo(): UseTempoReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { address, isConnected, connector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const connectors = useConnectors();
  const queryClient = useQueryClient();

  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  const walletType: WalletType = isConnected
    ? connector?.type === 'injected'
      ? 'injected'
      : 'passkey'
    : null;

  // Passkey sign-up: JWT comes from wallet API's KeyManager (shared JWT_SECRET)
  const signUp = useCallback(
    async (label?: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const passkeyLabel = label ? `Temporium: ${label}` : 'Temporium Playground';
        await connectAsync({
          connector: tempoPasskeyConnector,
          capabilities: { type: 'sign-up', label: passkeyLabel },
        });
        // JWT already saved by KeyManager in wagmi.ts (shared secret with playground API)
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectAsync]
  );

  // Passkey sign-in: JWT comes from wallet API's KeyManager (shared JWT_SECRET)
  const signIn = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectAsync({
        connector: tempoPasskeyConnector,
        capabilities: { type: 'sign-in', selectAccount: true },
      });
      // JWT already saved by KeyManager in wagmi.ts (shared secret with playground API)
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync]);

  // Injected wallet: needs SIWE to get a JWT from the playground API
  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await connectAsync({
        connector: injectedConnector,
        chainId: tempoChain.id,
      });

      const client = await getWalletClient(wagmiConfig, {
        account: result.accounts[0],
        chainId: tempoChain.id,
      });
      if (!client) throw new Error('Failed to get wallet client after connection');

      await signInWithEthereum(client);
    } catch (err) {
      setError(err as Error);
      try {
        await disconnectAsync();
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  const disconnect = useCallback(async () => {
    clearAuthTokens();
    queryClient.clear();
    if (isConnected) {
      await disconnectAsync();
    }
  }, [disconnectAsync, queryClient, isConnected]);

  const deployContract = useCallback(
    async (params: DeployContractParams): Promise<DeployResult> => {
      if (!walletClient || !address) throw new Error('Not connected');

      const hash = await walletClient.deployContract({
        abi: params.abi,
        bytecode: params.bytecode,
        args: params.args || [],
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
      } as any);

      const receipt = await waitForTx(hash);

      if (!receipt.contractAddress) {
        throw new Error('Contract deployment failed — no address in receipt');
      }

      return {
        address: receipt.contractAddress,
        txHash: hash,
      };
    },
    [walletClient, address]
  );

  return {
    isConnected,
    isConnecting,
    address,
    error,
    walletType,
    hasInjectedWallet,
    signUp,
    signIn,
    connectInjected,
    disconnect,
    deployContract,
  };
}
