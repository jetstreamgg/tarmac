import { request, gql } from 'graphql-request';
import { ReadHook } from '../../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_STALE_TIME
} from '../../constants';
import { getIndexerUrl } from '../../helpers/getIndexerUrl';
import { historyQueryArgs } from '../../shared/historyQueryHelpers';
import {
  SusdtVaultSupply,
  SusdtVaultWithdrawal,
  SusdtVaultHistory,
  SusdtVaultSupplyResponse,
  SusdtVaultWithdrawResponse
} from './susdtVaultHistory';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { TOKENS } from '../../tokens/tokens.constants';
import { isTestnetId } from '@/utils';
import { chainId as chainIdMap } from '@/utils';

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

async function fetchSusdtVaultHistory(
  urlIndexer: string,
  chainId: number,
  address?: string
): Promise<SusdtVaultHistory | undefined> {
  if (!address) return [];
  const query = gql`
    {
      ${susdtHistoryFragments({ owner: address.toLowerCase(), chainId })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  return mapSusdtHistoryResponse(response, chainId);
}

export function useSusdtVaultHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & { data?: SusdtVaultHistory } {
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
    queryKey: ['susdt-vault-history', urlIndexer, address, chainIdToUse],
    queryFn: () => fetchSusdtVaultHistory(urlIndexer, chainIdToUse, address)
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
