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

async function fetchSusdtVaultHistory(
  urlIndexer: string,
  chainId: number,
  address?: string
): Promise<SusdtVaultHistory | undefined> {
  if (!address) return [];
  const ownerClause = `(where: { owner: { _eq: "${address.toLowerCase()}" }, chainId: { _eq: ${chainId} } }, order_by: { blockTimestamp: desc })`;
  const query = gql`
    {
      susdtDeposits: SusdtDeposit${ownerClause} {
        assets
        blockTimestamp
        transactionHash
      }
      susdtWithdraws: SusdtWithdraw${ownerClause} {
        assets
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as any;
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
