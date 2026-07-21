import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_QUERY_LIMIT,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { TOKENS } from '../tokens/tokens.constants';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { SavingsHistory, SavingsHistoryItem } from '../savings/savings';

async function fetchL2SavingsHistory(
  urlIndexer: string,
  chainId: number,
  address?: string,
  tokenAddressMap?: Record<string, { symbol: string }>
): Promise<SavingsHistory | undefined> {
  if (!address) return [];

  if (!tokenAddressMap || Object.keys(tokenAddressMap).length === 0) {
    return [];
  }

  const sUsdsAddressForChain = TOKENS.susds.address[chainId];
  const wallet = address.toLowerCase();
  const query = gql`
  {
    usdsIn: Swap(where: {
      sender: { _eq: "${wallet}" },
      receiver: { _eq: "${wallet}" },
      assetIn: { _eq: "${sUsdsAddressForChain.toLowerCase()}" },
      chainId: { _eq: ${chainId} }
    }, order_by: { blockTimestamp: desc }, limit: ${HISTORY_QUERY_LIMIT}) {
      transactionHash
      assetIn
      assetOut
      sender
      amountIn
      amountOut
      blockTimestamp
    }
    usdsOut: Swap(where: {
      sender: { _eq: "${wallet}" },
      receiver: { _eq: "${wallet}" },
      assetOut: { _eq: "${sUsdsAddressForChain.toLowerCase()}" },
      chainId: { _eq: ${chainId} }
    }, order_by: { blockTimestamp: desc }, limit: ${HISTORY_QUERY_LIMIT}) {
      transactionHash
      assetIn
      assetOut
      sender
      amountIn
      amountOut
      blockTimestamp
    }
  }
  `;

  const response = (await request(urlIndexer, query)) as any;

  const swapsInParsed: SavingsHistory = response.usdsIn
    .map((e: any) => {
      const tokenAddress = e.assetOut.toLowerCase();
      const token = tokenAddressMap[tokenAddress];

      if (!token) {
        console.warn(
          `Skipping savings withdrawal due to missing token mapping for chainId ${chainId}:`,
          `token (${tokenAddress}): ${!!token}`
        );
        return null;
      }

      return {
        blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
        transactionHash: e.transactionHash,
        module: ModuleEnum.SAVINGS,
        type: TransactionTypeEnum.WITHDRAW,
        shares: BigInt(e.amountIn),
        assets: BigInt(e.amountOut),
        token,
        address: e.sender,
        chainId
      };
    })
    .filter((swap: SavingsHistoryItem | null) => swap !== null);

  const swapsOutParsed: SavingsHistory = response.usdsOut
    .map((e: any) => {
      const tokenAddress = e.assetIn.toLowerCase();
      const token = tokenAddressMap[tokenAddress];

      if (!token) {
        console.warn(
          `Skipping savings supply due to missing token mapping for chainId ${chainId}:`,
          `token (${tokenAddress}): ${!!token}`
        );
        return null;
      }

      return {
        blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
        transactionHash: e.transactionHash,
        module: ModuleEnum.SAVINGS,
        type: TransactionTypeEnum.SUPPLY,
        assets: BigInt(e.amountIn),
        shares: BigInt(e.amountOut),
        token,
        address: e.sender,
        chainId
      };
    })
    .filter((swap: SavingsHistoryItem | null) => swap !== null);

  return [...swapsInParsed, ...swapsOutParsed].sort(
    (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

export function useL2SavingsHistory({
  indexerUrl,
  enabled = true,
  chainId
}: {
  indexerUrl?: string;
  enabled?: boolean;
  chainId?: number;
} = {}): ReadHook & { data?: SavingsHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = chainId ?? currentChainId;
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainIdToUse) || '';
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer) && enabled && Boolean(tokenAddressMap) && Boolean(address),
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['L2-savings-history', urlIndexer, address, chainIdToUse],
    queryFn: () => fetchL2SavingsHistory(urlIndexer, chainIdToUse, address, tokenAddressMap)
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
