import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PendleTradeAction } from './constants';
import { PendleMarketHistoryHook, PendleTransactionRaw } from './pendle';
import { fetchPendleMarketTransactions } from './pendleApiClient';

const SURFACED_ACTIONS = new Set<string>(Object.values(PendleTradeAction));

/**
 * Hook for fetching the latest TRADES history of a Pendle market scoped to
 * the connected user. We never show unscoped market activity, so the query
 * is disabled until a wallet is connected.
 *
 * Pendle's API doesn't serve Tenderly, so we always query mainnet regardless
 * of the connected chain. Results are filtered to PT buy/sell actions.
 */
export function usePendleMarketHistory(
  marketAddress: `0x${string}` | undefined
): PendleMarketHistoryHook {
  const { address: userAddress } = useConnection();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'pendle-market-history',
      marketAddress?.toLowerCase(),
      userAddress?.toLowerCase()
    ],
    queryFn: async (): Promise<PendleTransactionRaw[]> => {
      if (!marketAddress || !userAddress) return [];
      const results = await fetchPendleMarketTransactions(mainnet.id, marketAddress, userAddress);
      return results.filter(tx => SURFACED_ACTIONS.has(tx.action));
    },
    enabled: !!marketAddress && !!userAddress,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  return {
    isLoading,
    data,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Pendle Markets API',
        href: 'https://api-v2.pendle.finance/core/docs',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
