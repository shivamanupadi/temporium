/**
 * Tempo wallet hook for playground.
 * Simplified version focused on wallet connection and contract deployment.
 */

import { useState, useCallback } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWalletClient,
  useConnectors,
  usePublicClient,
} from 'wagmi';
import type { Address, Abi, Hash } from 'viem';
import { tempoPasskeyConnector, injectedConnector } from '@/lib/wagmi';
import { tempoChain } from '@/lib/tempo-client';

export type WalletType = 'passkey' | 'injected' | null;

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
  callContract: (params: CallContractParams) => Promise<unknown>;
  writeContract: (params: WriteContractParams) => Promise<Hash>;
}

export interface DeployContractParams {
  abi: Abi;
  bytecode: `0x${string}`;
  args?: unknown[];
}

export interface DeployResult {
  hash: Hash;
  address: Address;
}

export interface CallContractParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: unknown[];
}

export interface WriteContractParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: unknown[];
}

export function useTempo(): UseTempoReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { address, isConnected, connector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const connectors = useConnectors();

  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  const walletType: WalletType = isConnected
    ? connector?.type === 'injected'
      ? 'injected'
      : 'passkey'
    : null;

  const signUp = useCallback(
    async (label?: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const passkeyLabel = label ? `Playground: ${label}` : 'Playground Wallet';
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

  const signIn = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
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

  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectAsync({
        connector: injectedConnector,
        chainId: tempoChain.id,
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync]);

  const disconnect = useCallback(async () => {
    await disconnectAsync();
  }, [disconnectAsync]);

  const deployContract = useCallback(
    async ({ abi, bytecode, args = [] }: DeployContractParams): Promise<DeployResult> => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected');
      }

      // Deploy contract
      const hash = await walletClient.deployContract({
        abi,
        bytecode,
        args,
      });

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error('Contract deployment failed - no address returned');
      }

      return {
        hash,
        address: receipt.contractAddress,
      };
    },
    [walletClient, publicClient]
  );

  const callContract = useCallback(
    async ({ address, abi, functionName, args = [] }: CallContractParams) => {
      if (!publicClient) {
        throw new Error('Client not available');
      }

      const result = await publicClient.readContract({
        address,
        abi,
        functionName,
        args,
      });

      return result;
    },
    [publicClient]
  );

  const writeContract = useCallback(
    async ({ address, abi, functionName, args = [] }: WriteContractParams): Promise<Hash> => {
      if (!walletClient) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address,
        abi,
        functionName,
        args,
      });

      return hash;
    },
    [walletClient]
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
    callContract,
    writeContract,
  };
}
