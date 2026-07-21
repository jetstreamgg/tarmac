import { useConnection, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { StUsdsHistoryItem } from './stusds';
import { request, gql } from 'graphql-request';
import { ModuleEnum, TransactionTypeEnum, HISTORY_STALE_TIME } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { isTestnetId } from '@/utils';
import { chainId as chainIdMap } from '@/utils';
import { CURVE_POOL_TOKEN_INDICES } from './providers/constants';
import { StUsdsProviderType } from './providers/types';

// Native stUSDS deposits/withdrawals plus Curve pool swaps in/out of stUSDS.
export function stusdsHistoryFragments({
  owner,
  chainId,
  beforeTimestamp
}: {
  owner: string;
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const ownerArgs = historyQueryArgs(
    `owner: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  const buyerArgs = historyQueryArgs(
    `buyer: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  return `
      stusdsDeposits: StusdsDeposit${ownerArgs} {
        assets
        blockTimestamp
        transactionHash
      }
      stusdsWithdraws: StusdsWithdraw${ownerArgs} {
        assets
        blockTimestamp
        transactionHash
      }
      curveTokenExchanges: CurveTokenExchange${buyerArgs} {
        soldId
        amountSold
        boughtId
        amountBought
        blockTimestamp
        transactionHash
      }
  `;
}

export function mapStusdsHistoryResponse(response: any, chainId: number) {
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

  const curveSwaps = (response.curveTokenExchanges || []).map((c: any) => {
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

  const combined = [...supplies, ...withdraws, ...curveSwaps];
  return combined.sort(
    (a: { blockTimestamp: Date }, b: { blockTimestamp: Date }) =>
      b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

async function fetchStusdsHistory(urlIndexer: string, chainId: number, address?: string) {
  if (!address) return [];
  const query = gql`
    {
      ${stusdsHistoryFragments({ owner: address.toLowerCase(), chainId })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  return mapStusdsHistoryResponse(response, chainId);
}

export type StUsdsHistoryHook = ReadHook & {
  data?: StUsdsHistoryItem[];
};

export function useStUsdsHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): StUsdsHistoryHook {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer) && enabled,
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['stusds-history', urlIndexer, address, chainIdToUse],
    queryFn: () => fetchStusdsHistory(urlIndexer, chainIdToUse, address)
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
