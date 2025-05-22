import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { UrnInfo, UrnInfoRaw } from './stakeModule';

async function fetchUrnsInfo(urlSubgraph: string, user: `0x${string}`): Promise<UrnInfo[] | undefined> {
  const query = gql`
  {
    sealedUrns(where: {owner: "${user.toLowerCase()}"} orderBy: index) {
      id
      blockTimestamp
      rewardContract {
        id
      }
      mkrLocked
      nstDebt
      owner
      voteDelegate {
        id
        ownerAddress
        totalDelegated
        metadata {
          name
          description
        }
      }
      index
    }
  }
`;

  const response = (await request(urlSubgraph, query)) as any;
  const parsedUrns = response.sealedUrns as UrnInfoRaw[];
  if (!parsedUrns) {
    return undefined;
  }

  return parsedUrns.map(
    (urn: UrnInfoRaw) =>
      ({
        ...urn,
        voteDelegate: urn.voteDelegate
          ? {
              ...urn.voteDelegate,
              totalDelegated: BigInt(urn.voteDelegate.totalDelegated || '0')
            }
          : null,
        mkrLocked: BigInt(urn.mkrLocked),
        nstDebt: BigInt(urn.nstDebt)
      }) as UrnInfo
  );
}

export function useUrnsInfo({
  subgraphUrl,
  chainId,
  user
}: {
  subgraphUrl?: string;
  chainId: number;
  user: `0x${string}`;
}): ReadHook & { data?: UrnInfo[] } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && user.length > 0 && user !== ZERO_ADDRESS),
    queryKey: ['urns-info', urlSubgraph, user],
    queryFn: () => fetchUrnsInfo(urlSubgraph, user)
  });

  return {
    isLoading,
    data,
    error,
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
