import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { UpgradeTotals } from './upgrade';
import { useChainId } from 'wagmi';

type GraphQLUpgradeTotalResponse = {
  total: string;
};

async function fetchUpgradeTotals(urlSubgraph: string): Promise<UpgradeTotals | undefined> {
  const query = gql`
    {
      mkrTotal: total(id: "mkrUpgraded") {
        total
      }
      daiTotal: total(id: "daiUpgraded") {
        total
      }
      skyUpgraded: total(id: "skyUpgraded") {
        total
      }
      skyUpgradeFees: total(id: "skyUpgradeFees") {
        total
      }
    }
  `;

  const response: Record<
    'mkrTotal' | 'daiTotal' | 'skyUpgraded' | 'skyUpgradeFees',
    GraphQLUpgradeTotalResponse
  > = await request(urlSubgraph, query);

  const totalDaiUpgraded = BigInt(response?.daiTotal?.total ?? '0');
  const totalMkrUpgraded = BigInt(response?.mkrTotal?.total ?? '0');
  const skyUpgraded = BigInt(response?.skyUpgraded?.total ?? '0');
  const skyUpgradeFees = BigInt(response?.skyUpgradeFees?.total ?? '0');
  const totalSkyUpgraded = skyUpgraded + skyUpgradeFees;
  return { totalDaiUpgraded, totalMkrUpgraded, skyUpgraded, skyUpgradeFees, totalSkyUpgraded };
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
