import { request, gql } from 'graphql-request';
import { ReadHook } from '../../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../../constants';
import { getSubgraphUrl } from '../../helpers/getSubgraphUrl';
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
  urlSubgraph: string,
  chainId: number,
  address?: string
): Promise<SusdtVaultHistory | undefined> {
  if (!address) return [];
  const query = gql`
    {
      susdtDeposits: SusdtDeposit(where: { owner: { _ilike: "${address}" }, chainId: { _eq: ${chainId} } }) {
        assets
        blockTimestamp
        transactionHash
      }
      susdtWithdraws: SusdtWithdraw(where: { owner: { _ilike: "${address}" }, chainId: { _eq: ${chainId} } }) {
        assets
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;
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
  subgraphUrl,
  enabled = true
}: {
  subgraphUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & { data?: SusdtVaultHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph) && enabled,
    queryKey: ['susdt-vault-history', urlSubgraph, address, chainIdToUse],
    queryFn: () => fetchSusdtVaultHistory(urlSubgraph, chainIdToUse, address)
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
