import { useMemo } from 'react';
import { useReadContracts, useChainId, useConnection } from 'wagmi';
import { erc20Abi } from 'viem';
import { chainId, isTestnetId } from '@/utils';
import { ZERO_ADDRESS } from '../constants';
import { PENDLE_MARKETS } from './constants';
import { PendleUserPtBalances, PendleUserPtBalancesHook } from './pendle';

/**
 * Hook for fetching the user's PT balance across every market in PENDLE_MARKETS.
 *
 * Returns a record keyed by `marketAddress` exactly as it appears in
 * PENDLE_MARKETS. Consumers should look up balances using the same config
 * entries (e.g. `balances[market.marketAddress]`). Markets the user does not
 * hold are present with `0n`. Drives:
 *   - "My positions" filter on the overview list
 *   - Matured-market hide-unless-held rule
 *   - Balances widget aggregation
 */
export function usePendleUserPtBalances(): PendleUserPtBalancesHook {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: PENDLE_MARKETS.map(market => ({
      address: market.ptToken,
      abi: erc20Abi,
      chainId: chainIdToUse,
      functionName: 'balanceOf' as const,
      args: [userAddress || ZERO_ADDRESS] as const
    })),
    query: {
      enabled: !!userAddress
    }
  });

  // DEMO BRANCH — DO NOT MERGE: fake a 100,000 PT balance for any connected
  // wallet so the matured-position card renders without on-chain state.
  const parsed = useMemo(() => {
    void data;
    if (!userAddress) return undefined;
    const balances = {} as PendleUserPtBalances;
    PENDLE_MARKETS.forEach(market => {
      balances[market.marketAddress] = 100_000n * 10n ** 18n;
    });
    return balances;
  }, [data, userAddress]);

  return {
    isLoading: false,
    data: parsed,
    error,
    mutate: refetch,
    dataSources: []
  };
}
