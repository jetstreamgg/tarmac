import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { stripChainIdPrefix } from '../helpers';
import { Bark, StakePosition } from './stakeModule';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

type StakePositionResponse = {
  // TODO: Update this to stakeUrns once the subgraph is updated
  stakingUrns: {
    skyLocked: string;
    usdsDebt: string;
    voteDelegate: {
      id: string;
    } | null;
    reward: {
      id: string;
    } | null;
    barks: Bark[];
  }[];
};

async function fetchStakePosition(
  urlSubgraph: string,
  urnIndex: number,
  chainId: number,
  address?: string
): Promise<StakePosition | undefined> {
  if (!address) return;
  const query = gql`
    {
      stakingUrns: StakingUrn(where: { owner: { _eq: "${address}" }, index: { _eq: "${urnIndex}" }, chainId: { _eq: ${chainId} } }) {
        skyLocked
        usdsDebt
        voteDelegate {
          id
        }
        reward {
          id
        }
        barks {
          id
          ilk
          clipperId
        }
      }
    }
  `;

  const response: StakePositionResponse = await request(urlSubgraph, query);

  if (!response.stakingUrns || response.stakingUrns.length === 0) return;
  const { skyLocked, usdsDebt, voteDelegate, reward } = response.stakingUrns[0];

  return {
    owner: address,
    index: urnIndex,
    skyLocked: BigInt(skyLocked),
    usdsDebt: BigInt(usdsDebt),
    selectedDelegate: voteDelegate?.id ? stripChainIdPrefix(voteDelegate.id) : undefined,
    selectedReward: reward?.id ? stripChainIdPrefix(reward.id) : undefined,
    barks: response.stakingUrns[0].barks.map(b => ({ ...b, id: stripChainIdPrefix(b.id) }))
  };
}

export function useStakePosition({
  subgraphUrl,
  urnIndex
}: {
  subgraphUrl?: string;
  urnIndex: number;
}): ReadHook & { data?: StakePosition } {
  const { address } = useConnection();
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['stake-position-details', urlSubgraph, address, urnIndex, chainId],
    queryFn: () => fetchStakePosition(urlSubgraph, urnIndex, chainId, address)
  });

  return {
    data,
    isLoading: !data && isLoading,
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
