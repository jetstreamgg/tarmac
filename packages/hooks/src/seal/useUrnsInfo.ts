import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { UrnInfo, UrnInfoRaw } from './sealModule';

async function fetchUrnsInfo(
  urlSubgraph: string,
  chainId: number,
  user: `0x${string}`
): Promise<UrnInfo[] | undefined> {
  const query = gql`
    {
      sealedUrns: SealUrn(where: { owner: { _ilike: "${user.toLowerCase()}" }, chainId: { _eq: ${chainId} } }, order_by: { index: asc }) {
        address
        blockTimestamp
        rewardContract {
          address
        }
        mkrLocked
        nstDebt
        owner
        voteDelegate {
          address
          ownerAddress
          totalDelegated
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
    (urn: UrnInfoRaw): UrnInfo => ({
      ...urn,
      voteDelegate: urn.voteDelegate
        ? {
            ...urn.voteDelegate,
            totalDelegated: BigInt(urn.voteDelegate.totalDelegated || '0')
          }
        : null,
      mkrLocked: BigInt(urn.mkrLocked),
      nstDebt: BigInt(urn.nstDebt)
    })
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
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && user.length > 0 && user !== ZERO_ADDRESS),
    queryKey: ['urns-info', urlSubgraph, user, chainId],
    queryFn: () => fetchUrnsInfo(urlSubgraph, chainId, user)
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
