import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { Bark, SealPosition } from './sealModule';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

type SealPositionResponse = {
  sealUrns: {
    mkrLocked: string;
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

async function fetchSealPosition(
  urlSubgraph: string,
  urnIndex: number,
  address?: string
): Promise<SealPosition | undefined> {
  if (!address) return;
  const query = gql`
    {
      sealUrns(where: {owner: "${address}", index: "${urnIndex}"}) {
        mkrLocked
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

  const response: SealPositionResponse = await request(urlSubgraph, query);

  if (!response.sealUrns || response.sealUrns.length === 0) return;
  const { mkrLocked, usdsDebt, voteDelegate, reward } = response.sealUrns[0];

  return {
    owner: address,
    index: urnIndex,
    mkrLocked: BigInt(mkrLocked),
    usdsDebt: BigInt(usdsDebt),
    selectedDelegate: voteDelegate?.id,
    selectedReward: reward?.id,
    barks: response.sealUrns[0].barks
  };
}

export function useSealPosition({
  subgraphUrl,
  urnIndex
}: {
  subgraphUrl?: string;
  urnIndex: number;
}): ReadHook & { data?: SealPosition } {
  const { address } = useConnection();
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['seal-position-details', urlSubgraph, address, urnIndex],
    queryFn: () => fetchSealPosition(urlSubgraph, urnIndex, address)
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
