import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';

const KNOWN_SPENDERS: { address: Address; label: string }[] = [
  { address: '0xdec0000000000000000000000000000000000000' as Address, label: 'Stablecoin DEX' },
  { address: '0x20fc000000000000000000000000000000000000' as Address, label: 'TIP-20 Factory' },
  { address: '0xfeec000000000000000000000000000000000000' as Address, label: 'Fee Manager' },
  { address: '0xcccccccc00000000000000000000000000000000' as Address, label: 'Validator' },
];

const MAX_UINT256 = 2n ** 256n - 1n;

export interface ApprovalEntry {
  token: Token;
  spender: Address;
  spenderLabel: string;
  allowance: bigint;
  isUnlimited: boolean;
}

interface UseApprovalsReturn {
  approvals: ApprovalEntry[];
  isLoading: boolean;
  refresh: () => void;
}

export function useApprovals(): UseApprovalsReturn {
  const { address } = useAccount();
  const { tokens, isLoading: tokensLoading } = useTokenList();

  // Build all token×spender pairs
  const pairs = useMemo(() => {
    return tokens.flatMap(token => KNOWN_SPENDERS.map(spender => ({ token, spender })));
  }, [tokens]);

  const allowanceQueries = useQueries({
    queries: pairs.map(({ token, spender }) => ({
      queryKey: ['allowance', token.address, spender.address, address],
      queryFn: async (): Promise<{
        token: Token;
        spender: Address;
        spenderLabel: string;
        allowance: bigint;
      } | null> => {
        if (!address) return null;
        try {
          const allowance = await Actions.token.getAllowance(tempoPublicClient, {
            token: token.address,
            spender: spender.address,
            account: address,
          });
          if (allowance === 0n) return null;
          return {
            token,
            spender: spender.address,
            spenderLabel: spender.label,
            allowance,
          };
        } catch {
          return null;
        }
      },
      enabled: !!address && tokens.length > 0,
      refetchInterval: TIMING.BALANCE_REFRESH_MS,
      staleTime: 10_000,
    })),
  });

  const isLoading = tokensLoading || allowanceQueries.some(q => q.isLoading);

  const approvals = useMemo((): ApprovalEntry[] => {
    return allowanceQueries
      .map(q => q.data)
      .filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined)
      .map(d => ({
        ...d,
        isUnlimited: d.allowance >= MAX_UINT256 - 1000n,
      }));
  }, [allowanceQueries]);

  const refresh = (): void => {
    allowanceQueries.forEach(q => q.refetch());
  };

  return { approvals, isLoading, refresh };
}
