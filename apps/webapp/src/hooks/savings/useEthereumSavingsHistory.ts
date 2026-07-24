import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import {
  historyQueryArgs,
  historyPageBoundary,
  clampHistoryPage,
  HistoryPage
} from '../shared/historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from '../shared/useHistoryPagination';
import {
  SavingsSupply,
  SavingsHistory,
  SavingsWithdrawal,
  SavingsSupplyResponse,
  SavingsWithdrawalResponse
} from './savings';
import { useConnection, useChainId } from 'wagmi';
import { TOKENS } from '../tokens/tokens.constants';
import { isTestnetId } from '@/utils';
import { chainId as chainIdMap } from '@/utils';

export function savingsHistoryFragments({
  owner,
  chainId,
  beforeTimestamp
}: {
  owner: string;
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const args = historyQueryArgs(`owner: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`, beforeTimestamp);
  return `
      savingsSupplies: SavingsSupply${args} {
        assets
        blockTimestamp
        transactionHash
      }
      savingsWithdraws: SavingsWithdraw${args} {
        blockTimestamp
        assets
        transactionHash
      }
  `;
}

export function mapSavingsHistoryResponse(response: any, chainId: number): SavingsHistory {
  const supplies: SavingsSupply[] = response.savingsSupplies.map((d: SavingsSupplyResponse) => ({
    assets: BigInt(d.assets),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.SAVINGS,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usds,
    chainId
  }));

  const withdraws: SavingsWithdrawal[] = response.savingsWithdraws.map((w: SavingsWithdrawalResponse) => ({
    assets: -BigInt(w.assets), //make withdrawals negative
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.SAVINGS,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usds,
    chainId
  }));

  const combined = [...supplies, ...withdraws];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

async function fetchEthereumSavingsHistoryPage(
  urlIndexer: string,
  chainId: number,
  address?: string,
  beforeTimestamp?: number
): Promise<HistoryPage<SavingsHistory[number]>> {
  if (!address) return { items: [], nextCursor: undefined };
  const query = gql`
    {
      ${savingsHistoryFragments({ owner: address.toLowerCase(), chainId, beforeTimestamp })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(mapSavingsHistoryResponse(response, chainId), nextCursor), nextCursor };
}

export function useEthereumSavingsHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & PaginatedHistory & { data?: SavingsHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer) && enabled,
      queryKey: ['savings-history', urlIndexer, address, chainIdToUse],
      fetchPage: beforeTimestamp =>
        fetchEthereumSavingsHistoryPage(urlIndexer, chainIdToUse, address, beforeTimestamp)
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
