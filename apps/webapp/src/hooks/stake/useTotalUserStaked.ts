import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

async function fetchTotalUserStaked(urlIndexer: string, chainId: number, address: string): Promise<bigint> {
  const query = gql`
    {
      stakingUrns: StakingUrn(where: { owner: { _ilike: "${address}" }, chainId: { _eq: ${chainId} } }) {
        skyLocked
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as { stakingUrns: { skyLocked: string }[] };

  if (!response.stakingUrns || response.stakingUrns.length === 0) {
    return 0n;
  }

  return response.stakingUrns.reduce((acum, urn) => {
    return acum + BigInt(urn.skyLocked);
  }, 0n);
}

export function useTotalUserStaked({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & { data?: bigint } {
  const { address } = useConnection();
  const chainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && address),
    queryKey: ['user-total-staked', urlIndexer, address, chainId],
    queryFn: () => fetchTotalUserStaked(urlIndexer, chainId, address!)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem indexer',
        href: urlIndexer,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
