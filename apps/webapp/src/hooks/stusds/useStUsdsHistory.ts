import { useConnection, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { StUsdsHistoryItem } from './stusds';
import { request, gql } from 'graphql-request';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import {
  historyQueryArgs,
  historyPageBoundary,
  clampHistoryPage,
  HistoryPage
} from '../shared/historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from '../shared/useHistoryPagination';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { familyMainnetId } from '@/utils';
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

async function fetchStusdsHistoryPage(
  urlIndexer: string,
  chainId: number,
  address?: string,
  beforeTimestamp?: number
): Promise<HistoryPage<StUsdsHistoryItem>> {
  if (!address) return { items: [], nextCursor: undefined };
  const query = gql`
    {
      ${stusdsHistoryFragments({ owner: address.toLowerCase(), chainId, beforeTimestamp })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(mapStusdsHistoryResponse(response, chainId), nextCursor), nextCursor };
}

export type StUsdsHistoryHook = ReadHook &
  PaginatedHistory & {
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
  const chainIdToUse = familyMainnetId(currentChainId);

  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer) && enabled,
      queryKey: ['stusds-history', urlIndexer, address, chainIdToUse],
      fetchPage: beforeTimestamp => fetchStusdsHistoryPage(urlIndexer, chainIdToUse, address, beforeTimestamp)
    });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
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
