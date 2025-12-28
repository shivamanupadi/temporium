/**
 * Hook for deployed contracts management with React Query.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  getDeployedContracts,
  getDeployedContract,
  saveDeployedContract,
  deleteDeployedContract,
  renameContract,
  type DeployedContract,
} from '@/lib/contracts-storage';

const CONTRACTS_KEY = ['deployed-contracts'];

/**
 * Get all deployed contracts
 */
export function useDeployedContracts(): UseQueryResult<DeployedContract[]> {
  return useQuery({
    queryKey: CONTRACTS_KEY,
    queryFn: getDeployedContracts,
  });
}

/**
 * Get a single deployed contract by address
 */
export function useDeployedContract(
  address: Address | undefined
): UseQueryResult<DeployedContract | undefined> {
  return useQuery({
    queryKey: [...CONTRACTS_KEY, address],
    queryFn: () => (address ? getDeployedContract(address) : undefined),
    enabled: !!address,
  });
}

/**
 * Save a deployed contract
 */
export function useSaveDeployedContract(): UseMutationResult<void, Error, DeployedContract> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contract: DeployedContract) => {
      await saveDeployedContract(contract);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_KEY });
    },
  });
}

/**
 * Delete a deployed contract
 */
export function useDeleteDeployedContract(): UseMutationResult<void, Error, Address> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (address: Address) => {
      await deleteDeployedContract(address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_KEY });
    },
  });
}

/**
 * Rename a deployed contract
 */
export function useRenameContract(): UseMutationResult<
  void,
  Error,
  { address: Address; name: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ address, name }: { address: Address; name: string }) => {
      await renameContract(address, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_KEY });
    },
  });
}
