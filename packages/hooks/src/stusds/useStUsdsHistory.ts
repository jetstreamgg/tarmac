import { useAccount, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { StUsdsHistoryItem } from './stusds.d';
import { request, gql } from 'graphql-request';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { chainId as chainIdMap } from '@jetstreamgg/sky-utils';

async function fetchStusdsHistory(urlSubgraph: string, chainId: number, address?: string) {
  if (!address) return [];
  const query = gql`
    {
      yusdsDeposits(where: {owner: "${address}"}) {
        assets
        blockTimestamp
        transactionHash
      }
      yusdsWithdraws(where: {owner: "${address}"}) {
        assets
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;
  const supplies = response.yusdsDeposits.map((d: any) => ({
    assets: BigInt(d.assets),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usds,
    chainId
  }));

  const withdraws = response.yusdsWithdraws.map((w: any) => ({
    assets: -BigInt(w.assets), //make withdrawals negative
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usds,
    chainId
  }));

  const combined = [...supplies, ...withdraws];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

export type StUsdsHistoryHook = ReadHook & {
  data?: StUsdsHistoryItem[];
};

export function useStUsdsHistory({
  subgraphUrl,
  enabled = true
}: {
  subgraphUrl?: string;
  enabled?: boolean;
} = {}): StUsdsHistoryHook {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph) && enabled,
    queryKey: ['stusds-history', urlSubgraph, address, chainIdToUse],
    queryFn: () => fetchStusdsHistory(urlSubgraph, chainIdToUse, address)
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
