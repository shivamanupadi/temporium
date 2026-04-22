import { useMemo, useCallback } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAbiItem, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';
import {
  getWatchedSpenders,
  addWatchedSpender,
  deleteWatchedSpender,
} from '@/lib/watched-spenders';
import { formatAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Label map - friendly names for known protocol contracts.
// Used purely for display; discovery is on-chain.
// ---------------------------------------------------------------------------
const SPENDER_LABELS: Record<string, string> = {
  '0xdec0000000000000000000000000000000000000': 'Stablecoin DEX',
  '0x20fc000000000000000000000000000000000000': 'TIP-20 Factory',
  '0xfeec000000000000000000000000000000000000': 'Fee Manager',
  '0xcccccccc00000000000000000000000000000000': 'Validator',
};

// Static spenders we always check (protocol precompiles / known contracts)
const STATIC_SPENDER_ADDRESSES: Address[] = [
  '0xdec0000000000000000000000000000000000000' as Address,
  '0x20fc000000000000000000000000000000000000' as Address,
  '0xfeec000000000000000000000000000000000000' as Address,
  '0xcccccccc00000000000000000000000000000000' as Address,
];

const APPROVAL_EVENT = parseAbiItem(
  'event Approval(address indexed owner, address indexed spender, uint256 amount)'
);

const SCAN_BLOCK_RANGE = 100_000n;

const MAX_UINT256 = 2n ** 256n - 1n;

export interface ApprovalEntry {
  token: Token;
  spender: Address;
  spenderLabel: string;
  allowance: bigint;
  isUnlimited: boolean;
  isWatched: boolean;
}

interface UseApprovalsReturn {
  approvals: ApprovalEntry[];
  isLoading: boolean;
  refresh: () => void;
  watchedSpenderAddresses: Set<string>;
  saveSpender: (address: Address, label?: string) => Promise<void>;
  removeSpender: (id: string) => Promise<void>;
}

/**
 * Resolves a friendly label for a spender address.
 * Falls back to "Unknown (0x12...5678)" for unknown spenders.
 */
function getSpenderLabel(address: Address, watchedLabels: Record<string, string>): string {
  const key = address.toLowerCase();
  // 1. Static known labels
  if (SPENDER_LABELS[key]) return SPENDER_LABELS[key];
  // 2. User-saved watched spender labels
  if (watchedLabels[key]) return watchedLabels[key];
  // 3. Fallback with truncated address
  return `Unknown (${formatAddress(address, 4)})`;
}

export function useApprovals(): UseApprovalsReturn {
  const { address } = useAccount();
  const { tokens, isLoading: tokensLoading } = useTokenList();
  const queryClient = useQueryClient();

  // ------------------------------------------------------------------
  // 1. Discover spenders from on-chain Approval events (last 100k blocks)
  // ------------------------------------------------------------------
  const { data: discoveredSpenders = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['approval-events', address, tokens.map(t => t.address).join(',')],
    queryFn: async (): Promise<Address[]> => {
      if (!address || tokens.length === 0) return [];

      const currentBlock = await tempoPublicClient.getBlockNumber();
      const fromBlock = currentBlock > SCAN_BLOCK_RANGE ? currentBlock - SCAN_BLOCK_RANGE : 0n;

      // Query each token for Approval events where owner = user
      const allLogs = await Promise.all(
        tokens.map(token =>
          tempoPublicClient
            .getLogs({
              address: token.address,
              event: APPROVAL_EVENT,
              args: { owner: address },
              fromBlock,
              toBlock: 'latest',
            })
            .catch(() => [])
        )
      );

      // Extract unique spender addresses
      const spenderSet = new Set<string>();
      for (const logs of allLogs) {
        for (const log of logs) {
          const spender = log.args.spender;
          if (spender) spenderSet.add(spender.toLowerCase());
        }
      }

      return Array.from(spenderSet) as Address[];
    },
    enabled: !!address && tokens.length > 0,
    staleTime: 60_000, // cache for 1 minute
    refetchInterval: TIMING.BALANCE_REFRESH_MS * 2,
  });

  // ------------------------------------------------------------------
  // 2. Load watched spenders from D1
  // ------------------------------------------------------------------
  const { data: watchedSpendersData = [] } = useQuery({
    queryKey: ['watched-spenders'],
    queryFn: getWatchedSpenders,
    staleTime: 30_000,
  });

  // Build lookup maps from watched spenders
  const { watchedLabels, watchedSpenderAddresses } = useMemo(() => {
    const labels: Record<string, string> = {};
    const addresses = new Set<string>();
    for (const ws of watchedSpendersData) {
      const key = ws.address.toLowerCase();
      addresses.add(key);
      if (ws.label) labels[key] = ws.label;
    }
    return { watchedLabels: labels, watchedSpenderAddresses: addresses };
  }, [watchedSpendersData]);

  // ------------------------------------------------------------------
  // 3. Merge all spender sources (static + watched + discovered)
  // ------------------------------------------------------------------
  const allSpenders = useMemo(() => {
    const seen = new Set<string>();
    const result: Address[] = [];

    const addSpender = (addr: Address): void => {
      const key = addr.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(addr);
      }
    };

    // Static known spenders
    for (const addr of STATIC_SPENDER_ADDRESSES) addSpender(addr);

    // Watched spenders from D1
    for (const ws of watchedSpendersData) addSpender(ws.address as Address);

    // On-chain discovered spenders
    for (const addr of discoveredSpenders) addSpender(addr as Address);

    return result;
  }, [discoveredSpenders, watchedSpendersData]);

  // Build set of "known" addresses (static + watched) for isWatched check
  const knownAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const addr of STATIC_SPENDER_ADDRESSES) set.add(addr.toLowerCase());
    for (const ws of watchedSpendersData) set.add(ws.address.toLowerCase());
    return set;
  }, [watchedSpendersData]);

  // ------------------------------------------------------------------
  // 4. Query current allowance for each token × spender pair
  // ------------------------------------------------------------------
  const pairs = useMemo(() => {
    return tokens.flatMap(token => allSpenders.map(spender => ({ token, spender })));
  }, [tokens, allSpenders]);

  const allowanceQueries = useQueries({
    queries: pairs.map(({ token, spender }) => ({
      queryKey: ['allowance', token.address, spender, address],
      queryFn: async (): Promise<{
        token: Token;
        spender: Address;
        spenderLabel: string;
        allowance: bigint;
        isWatched: boolean;
      } | null> => {
        if (!address) return null;
        try {
          const allowance = await Actions.token.getAllowance(tempoPublicClient, {
            token: token.address,
            spender,
            account: address,
          });
          if (allowance === 0n) return null;
          return {
            token,
            spender,
            spenderLabel: getSpenderLabel(spender, watchedLabels),
            allowance,
            isWatched: knownAddresses.has(spender.toLowerCase()),
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

  const isLoading = tokensLoading || eventsLoading || allowanceQueries.some(q => q.isLoading);

  const approvals = useMemo((): ApprovalEntry[] => {
    return allowanceQueries
      .map(q => q.data)
      .filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined)
      .map(d => ({
        ...d,
        isUnlimited: d.allowance >= MAX_UINT256 - 1000n,
      }));
  }, [allowanceQueries]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['allowance'] });
    await queryClient.invalidateQueries({ queryKey: ['approval-events'] });
    await queryClient.invalidateQueries({ queryKey: ['watched-spenders'] });
  }, [queryClient]);

  const saveSpender = useCallback(
    async (spenderAddress: Address, label?: string) => {
      await addWatchedSpender(spenderAddress, label);
      await queryClient.invalidateQueries({ queryKey: ['watched-spenders'] });
      await queryClient.invalidateQueries({ queryKey: ['allowance'] });
    },
    [queryClient]
  );

  const removeSpender = useCallback(
    async (id: string) => {
      await deleteWatchedSpender(id);
      await queryClient.invalidateQueries({ queryKey: ['watched-spenders'] });
      await queryClient.invalidateQueries({ queryKey: ['allowance'] });
    },
    [queryClient]
  );

  return {
    approvals,
    isLoading,
    refresh,
    watchedSpenderAddresses,
    saveSpender,
    removeSpender,
  };
}
