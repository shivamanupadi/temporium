import { useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { useStablecoins, type StablecoinWithMetadata } from './useStablecoins';
import type { TokenRole } from '@/types';

interface UseStablecoinReturn {
  stablecoin: StablecoinWithMetadata | undefined;
  isLoading: boolean;
  isNotFound: boolean;
  mintTokens: (params: {
    to: Address;
    amount: bigint;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  burnTokens: (params: { amount: bigint }) => Promise<{ receipt: { transactionHash: string } }>;
  pauseToken: (params?: {
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  unpauseToken: (params?: {
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  setSupplyCap: (supplyCap: bigint) => Promise<{ receipt: { transactionHash: string } }>;
  grantRoles: (params: {
    to: Address;
    roles: readonly TokenRole[];
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  revokeRoles: (params: {
    from: Address;
    roles: readonly TokenRole[];
  }) => Promise<{ receipt: { transactionHash: string } }>;
  burnBlocked: (params: {
    from: Address;
    amount: bigint;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  removeStablecoin: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing a single stablecoin by address.
 * Wraps useStablecoins and provides bound actions for the specific token.
 */
export function useStablecoin(tokenAddress: string): UseStablecoinReturn {
  const {
    stablecoins,
    isLoading,
    mintTokens: mintTokensBase,
    burnTokens: burnTokensBase,
    pauseToken: pauseTokenBase,
    unpauseToken: unpauseTokenBase,
    setSupplyCap: setSupplyCapBase,
    grantRoles: grantRolesBase,
    revokeRoles: revokeRolesBase,
    burnBlocked: burnBlockedBase,
    removeStablecoin: removeStablecoinBase,
    refresh,
  } = useStablecoins();

  const normalizedAddress = tokenAddress.toLowerCase() as Address;

  const stablecoin = useMemo(
    () => stablecoins.find(s => s.address.toLowerCase() === normalizedAddress),
    [stablecoins, normalizedAddress]
  );

  const isNotFound = !isLoading && !stablecoin;

  const mintTokens = useCallback(
    async (params: { to: Address; amount: bigint }) => {
      return mintTokensBase({ token: normalizedAddress, ...params });
    },
    [mintTokensBase, normalizedAddress]
  );

  const burnTokens = useCallback(
    async (params: { amount: bigint }) => {
      return burnTokensBase({ token: normalizedAddress, ...params });
    },
    [burnTokensBase, normalizedAddress]
  );

  const pauseToken = useCallback(
    async (params?: { feeToken?: Address }) => {
      return pauseTokenBase({ token: normalizedAddress, feeToken: params?.feeToken });
    },
    [pauseTokenBase, normalizedAddress]
  );

  const unpauseToken = useCallback(
    async (params?: { feeToken?: Address }) => {
      return unpauseTokenBase({ token: normalizedAddress, feeToken: params?.feeToken });
    },
    [unpauseTokenBase, normalizedAddress]
  );

  const setSupplyCap = useCallback(
    async (supplyCap: bigint) => {
      return setSupplyCapBase({ token: normalizedAddress, supplyCap });
    },
    [setSupplyCapBase, normalizedAddress]
  );

  const grantRoles = useCallback(
    async (params: { to: Address; roles: readonly TokenRole[] }) => {
      return grantRolesBase({ token: normalizedAddress, ...params });
    },
    [grantRolesBase, normalizedAddress]
  );

  const revokeRoles = useCallback(
    async (params: { from: Address; roles: readonly TokenRole[] }) => {
      return revokeRolesBase({ token: normalizedAddress, ...params });
    },
    [revokeRolesBase, normalizedAddress]
  );

  const burnBlocked = useCallback(
    async (params: { from: Address; amount: bigint }) => {
      return burnBlockedBase({ token: normalizedAddress, ...params });
    },
    [burnBlockedBase, normalizedAddress]
  );

  const removeStablecoin = useCallback(async () => {
    if (stablecoin?.id) {
      await removeStablecoinBase(stablecoin.id);
    }
  }, [removeStablecoinBase, stablecoin?.id]);

  return {
    stablecoin,
    isLoading,
    isNotFound,
    mintTokens,
    burnTokens,
    pauseToken,
    unpauseToken,
    setSupplyCap,
    grantRoles,
    revokeRoles,
    burnBlocked,
    removeStablecoin,
    refresh,
  };
}
