import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import {
  SavingsSupply,
  SavingsHistory,
  SavingsWithdrawal,
  SavingsSupplyResponse,
  SavingsWithdrawalResponse
} from './savings';
import { useQuery } from '@tanstack/react-query';
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

async function fetchEthereumSavingsHistory(
  urlIndexer: string,
  chainId: number,
  address?: string
): Promise<SavingsHistory | undefined> {
  if (!address) return [];
  const query = gql`
    {
      ${savingsHistoryFragments({ owner: address.toLowerCase(), chainId })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  return mapSavingsHistoryResponse(response, chainId);
}

export function useEthereumSavingsHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & { data?: SavingsHistory } {
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
    queryKey: ['savings-history', urlIndexer, address, chainIdToUse],
    queryFn: () => fetchEthereumSavingsHistory(urlIndexer, chainIdToUse, address)
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
