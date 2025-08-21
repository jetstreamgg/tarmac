import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { UpgradeTotalResponses, UpgradeTotals } from './upgrade';
import { useChainId } from 'wagmi';

async function fetchUpgradeTotals(urlSubgraph: string): Promise<UpgradeTotals | undefined> {
  const query = gql`
    {
      mkrTotal: total(id: "mkrUpgraded") {
        total
      }
      daiTotal: total(id: "daiUpgraded") {
        total
      }
      skyTotal: total(id: "skyUpgraded") {
        total
      }
    }
  `;

  const response: Record<'mkrTotal' | 'daiTotal' | 'skyTotal', UpgradeTotalResponses> = await request(
    urlSubgraph,
    query
  );

  const totalDaiUpgraded = response?.daiTotal?.total ?? '0';
  const totalMkrUpgraded = response?.mkrTotal?.total ?? '0';
  const totalSkyUpgraded = response?.skyTotal?.total ?? '0';
  return { totalDaiUpgraded, totalMkrUpgraded, totalSkyUpgraded };
}

export function useUpgradeTotals({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data?: UpgradeTotals } {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['upgrade-totals', urlSubgraph],
    queryFn: () => fetchUpgradeTotals(urlSubgraph)
  });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
