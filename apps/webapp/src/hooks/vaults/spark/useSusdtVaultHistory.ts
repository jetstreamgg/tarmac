import { request, gql } from 'graphql-request';
import { ReadHook } from '../../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../../constants';
import { getIndexerUrl } from '../../helpers/getIndexerUrl';
import {
  historyQueryArgs,
  historyPageBoundary,
  clampHistoryPage,
  HistoryPage
} from '../../shared/historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from '../../shared/useHistoryPagination';
import {
  SusdtVaultSupply,
  SusdtVaultWithdrawal,
  SusdtVaultHistory,
  SusdtVaultSupplyResponse,
  SusdtVaultWithdrawResponse
} from './susdtVaultHistory';
import { useConnection, useChainId } from 'wagmi';
import { TOKENS } from '../../tokens/tokens.constants';
import { familyMainnetId } from '@/utils';

export function susdtHistoryFragments({
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
      susdtDeposits: SusdtDeposit${args} {
        assets
        blockTimestamp
        transactionHash
      }
      susdtWithdraws: SusdtWithdraw${args} {
        assets
        blockTimestamp
        transactionHash
      }
  `;
}

export function mapSusdtHistoryResponse(response: any, chainId: number): SusdtVaultHistory {
  const supplies: SusdtVaultSupply[] = response.susdtDeposits.map((d: SusdtVaultSupplyResponse) => ({
    assets: BigInt(d.assets),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.SUSDT,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usdt,
    chainId
  }));

  const withdraws: SusdtVaultWithdrawal[] = response.susdtWithdraws.map((w: SusdtVaultWithdrawResponse) => ({
    assets: -BigInt(w.assets), //make withdrawals negative
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.SUSDT,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usdt,
    chainId
  }));

  const combined = [...supplies, ...withdraws];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

async function fetchSusdtVaultHistoryPage(
  urlIndexer: string,
  chainId: number,
  address?: string,
  beforeTimestamp?: number
): Promise<HistoryPage<SusdtVaultHistory[number]>> {
  if (!address) return { items: [], nextCursor: undefined };
  const query = gql`
    {
      ${susdtHistoryFragments({ owner: address.toLowerCase(), chainId, beforeTimestamp })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(mapSusdtHistoryResponse(response, chainId), nextCursor), nextCursor };
}

export function useSusdtVaultHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & PaginatedHistory & { data?: SusdtVaultHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = familyMainnetId(currentChainId);

  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer) && enabled,
      queryKey: ['susdt-vault-history', urlIndexer, address, chainIdToUse],
      fetchPage: beforeTimestamp =>
        fetchSusdtVaultHistoryPage(urlIndexer, chainIdToUse, address, beforeTimestamp)
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
