import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import type { Address, Hex } from 'viem';
import { Actions, VirtualMaster } from 'viem/tempo';

import { TEMPO_NETWORK } from '@/lib/constants';
import { tempoPublicClient } from '@/lib/tempo-client';
import { ApiClientError } from '@/lib/api-client';
import {
  createVirtualAddress,
  deleteVirtualAddress,
  getVirtualMaster,
  importVirtualAddress,
  listVirtualAddresses,
  lookupVirtualMaster,
  mineSaltViaApi,
  recoverVirtualMaster,
  registerVirtualMaster,
  type CreateVirtualAddressBody,
  type ImportVirtualAddressBody,
  type VirtualAddress,
  type VirtualMaster as VirtualMasterRow,
} from '@/lib/virtual-addresses-api';

export const VIRTUAL_MASTER_QUERY_KEY = 'virtualMaster';
export const VIRTUAL_ADDRESSES_QUERY_KEY = 'virtualAddresses';

export type RegisterPhase = 'mining' | 'signing' | 'confirming' | 'saving';

export class MasterAlreadyRegisteredError extends Error {
  constructor(message = 'A master is already registered for this wallet') {
    super(message);
    this.name = 'MasterAlreadyRegisteredError';
  }
}

interface UseVirtualMasterReturn {
  master: VirtualMasterRow | null;
  /** Master row only when status === 'registered'. Null while pending or absent. */
  registeredMaster: VirtualMasterRow | null;
  /** Master row only when status === 'pending'. Used by the wizard to resume sign step. */
  pendingMaster: VirtualMasterRow | null;
  isLoading: boolean;
  isRegistering: boolean;
  register: (opts: {
    signal?: AbortSignal;
    onProgress?: (phase: RegisterPhase) => void;
  }) => Promise<VirtualMasterRow>;
  /** Persist an already-registered masterId. Server verifies on-chain. */
  lookup: (masterId: Hex) => Promise<VirtualMasterRow>;
  /** Search the last ~10 days of MasterRegistered events for the caller's master. */
  recover: () => Promise<VirtualMasterRow>;
  refresh: () => Promise<void>;
}

/**
 * Tracks the caller's master registration state and provides a register() flow
 * that mines a PoW salt in-browser, submits registerVirtualMaster on-chain,
 * and persists the record via our API.
 */
export function useVirtualMaster(): UseVirtualMasterReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const query = useQuery<VirtualMasterRow | null>({
    queryKey: [VIRTUAL_MASTER_QUERY_KEY, address],
    queryFn: async () => {
      if (!address) return null;
      try {
        return await getVirtualMaster();
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!address,
    staleTime: 30_000,
  });

  type RegisterArgs = {
    signal?: AbortSignal;
    onProgress?: (phase: RegisterPhase) => void;
  };

  const mutation = useMutation<VirtualMasterRow, Error, RegisterArgs>({
    mutationFn: async ({ signal, onProgress }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      onProgress?.('mining');
      const startedAt = Date.now();

      // Server-side mining via Cloudflare Container. The server persists the
      // mined salt as a `pending` row before responding, so a closed tab /
      // refresh doesn't lose 90+ seconds of work — we just resume here.
      const mined = await mineSaltViaApi();
      if (mined.resumed) {
        console.info('[virtual-addresses] resumed pending master:', mined.masterId);
      } else {
        console.info(
          `[virtual-addresses] freshly mined in ${Math.round((Date.now() - startedAt) / 1000)}s ` +
            `(server-reported ${mined.elapsedMs}ms)`
        );
      }

      const salt = mined.salt;
      if (!VirtualMaster.validateSalt({ address, salt })) {
        throw new Error('Server returned an invalid salt — refusing to broadcast');
      }
      const masterId = VirtualMaster.getMasterId({ address, salt }) as Hex;
      if (masterId.toLowerCase() !== mined.masterId.toLowerCase()) {
        throw new Error('Server-derived masterId does not match locally-derived masterId');
      }

      if (signal?.aborted) throw new Error('Cancelled');

      onProgress?.('signing');
      let hash: Hex;
      try {
        hash = (await Actions.virtualAddress.registerMaster(walletClient, { salt })) as Hex;
      } catch (err) {
        // Re-registering from the same address always reverts (registrations
        // are immutable per TIP-1022). Treat any wallet-level revert as the
        // already-registered case and route the user to the lookup flow.
        const message = err instanceof Error ? err.message : String(err);
        if (looksLikeAlreadyRegistered(message)) {
          throw new MasterAlreadyRegisteredError();
        }
        throw err;
      }

      onProgress?.('confirming');
      const receipt = await tempoPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new MasterAlreadyRegisteredError(
          'Registration reverted on-chain — this wallet likely has a master already.'
        );
      }

      onProgress?.('saving');
      const saved = await registerVirtualMaster({
        masterId,
        salt,
        txHash: hash,
        network: TEMPO_NETWORK as 'testnet' | 'mainnet',
      });

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIRTUAL_MASTER_QUERY_KEY, address] });
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [VIRTUAL_MASTER_QUERY_KEY, address] });
  }, [queryClient, address]);

  const register = useCallback(
    async (opts: RegisterArgs) => mutation.mutateAsync(opts),
    [mutation]
  );

  const lookup = useCallback(
    async (masterId: Hex) => {
      const saved = await lookupVirtualMaster({ masterId });
      await refresh();
      return saved;
    },
    [refresh]
  );

  const recover = useCallback(async () => {
    const saved = await recoverVirtualMaster();
    await refresh();
    return saved;
  }, [refresh]);

  const master = query.data ?? null;
  const registeredMaster = master?.status === 'registered' ? master : null;
  const pendingMaster = master?.status === 'pending' ? master : null;

  return {
    master,
    registeredMaster,
    pendingMaster,
    isLoading: query.isLoading,
    isRegistering: mutation.isPending,
    register,
    lookup,
    recover,
    refresh,
  };
}

function looksLikeAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('mastercollision') ||
    m.includes('mastericollision') ||
    m.includes('master already') ||
    // Generic revert signature when the registry rejects re-registration.
    m.includes('execution reverted')
  );
}

interface UseVirtualAddressesReturn {
  addresses: VirtualAddress[];
  isLoading: boolean;
  create: (body: CreateVirtualAddressBody) => Promise<VirtualAddress>;
  importAddress: (body: ImportVirtualAddressBody) => Promise<VirtualAddress>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useVirtualAddresses(): UseVirtualAddressesReturn {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const query = useQuery<VirtualAddress[]>({
    queryKey: [VIRTUAL_ADDRESSES_QUERY_KEY, address],
    queryFn: () => listVirtualAddresses(),
    enabled: !!address,
    staleTime: 15_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [VIRTUAL_ADDRESSES_QUERY_KEY, address] }),
    [queryClient, address]
  );

  const create = useCallback(
    async (body: CreateVirtualAddressBody) => {
      const created = await createVirtualAddress(body);
      await invalidate();
      return created;
    },
    [invalidate]
  );

  const importAddress = useCallback(
    async (body: ImportVirtualAddressBody) => {
      const imported = await importVirtualAddress(body);
      await invalidate();
      return imported;
    },
    [invalidate]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteVirtualAddress(id);
      await invalidate();
    },
    [invalidate]
  );

  const refresh = useCallback(async () => {
    await invalidate();
  }, [invalidate]);

  return {
    addresses: query.data ?? [],
    isLoading: query.isLoading,
    create,
    importAddress,
    remove,
    refresh,
  };
}

// Re-export types for convenience at call sites.
export type { VirtualAddress, VirtualMasterRow as VirtualMaster };
// Address is imported so the transitive types compile when a consumer uses hex-typed props.
export type { Address };
