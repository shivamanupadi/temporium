import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';

export interface DeployedContract {
  id: string;
  owner: string;
  projectId?: string;
  name: string;
  address: string;
  abi: string;
  bytecode: string;
  txHash?: string;
  constructorArgs?: string;
  network: string;
  sourcePath?: string;
  deployedAt: string;
}

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiGet<DeployedContract[]>('/v1/contracts'),
  });
}

export function useSaveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<DeployedContract, 'id' | 'owner' | 'deployedAt'>) =>
      apiPost<DeployedContract>('/v1/contracts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}
