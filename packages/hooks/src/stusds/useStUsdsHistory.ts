import { useConnection, useChainId } from 'wagmi';
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
import { CURVE_POOL_TOKEN_INDICES } from './providers/constants';
import { StUsdsProviderType } from './providers/types';

// Fetch native stUSDS history (deposits and withdrawals)
async function fetchNativeStusdsHistory(urlSubgraph: string, chainId: number, address: string) {
  const query = gql`
    {
      stusdsDeposits(where: {owner: "${address}"}) {
        assets
        blockTimestamp
        transactionHash
      }
      stusdsWithdraws(where: {owner: "${address}"}) {
        assets
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;

  const supplies = (response.stusdsDeposits || []).map((d: any) => ({
    assets: BigInt(d.assets),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usds,
    chainId,
    provider: StUsdsProviderType.NATIVE
  }));

  const withdraws = (response.stusdsWithdraws || []).map((w: any) => ({
    assets: -BigInt(w.assets),
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usds,
    chainId,
    provider: StUsdsProviderType.NATIVE
  }));

  return [...supplies, ...withdraws];
}

// Fetch Curve pool swap history (optional, may not exist in subgraph yet)
async function fetchCurveStusdsHistory(urlSubgraph: string, chainId: number, address: string) {
  const query = gql`
    {
      curveTokenExchanges(where: {buyer: "${address}"}) {
        soldId
        amountSold
        boughtId
        amountBought
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;

  return (response.curveTokenExchanges || []).map((c: any) => {
    const soldId = parseInt(c.soldId);
    // If user sold USDS (index 0), it's a supply (USDS → stUSDS)
    // If user sold stUSDS (index 1), it's a withdraw (stUSDS → USDS)
    const isSupply = soldId === CURVE_POOL_TOKEN_INDICES.USDS;

    return {
      // For supply: positive USDS amount sold
      // For withdraw: negative USDS amount received
      assets: isSupply ? BigInt(c.amountSold) : -BigInt(c.amountBought),
      blockTimestamp: new Date(parseInt(c.blockTimestamp) * 1000),
      transactionHash: c.transactionHash,
      module: ModuleEnum.STUSDS,
      type: isSupply ? TransactionTypeEnum.SUPPLY : TransactionTypeEnum.WITHDRAW,
      token: TOKENS.usds,
      chainId,
      provider: StUsdsProviderType.CURVE
    };
  });
}

async function fetchStusdsHistory(urlSubgraph: string, chainId: number, address?: string) {
  if (!address) return [];

  // Fetch native history first (required)
  let nativeHistory: any[] = [];
  try {
    nativeHistory = await fetchNativeStusdsHistory(urlSubgraph, chainId, address);
  } catch (err) {
    console.error('Error fetching native stUSDS history:', err);
  }

  // Try to fetch Curve history (optional - graceful degradation if not available)
  let curveHistory: any[] = [];
  try {
    curveHistory = await fetchCurveStusdsHistory(urlSubgraph, chainId, address);
  } catch (err) {
    // Curve history not available yet in subgraph, continue with just native history
    console.debug('Curve history not available in subgraph:', err);
  }

  const combined = [...nativeHistory, ...curveHistory];
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
  const { address } = useConnection();
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
