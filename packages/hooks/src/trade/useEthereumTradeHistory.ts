import { ReadHook } from '../hooks';
import {
  ModuleEnum,
  TENDERLY_CHAIN_ID,
  TRUST_LEVELS,
  TransactionTypeEnum,
  TrustLevelEnum
} from '../constants';
import { useQuery } from '@tanstack/react-query';
import { TradeHistory } from './trade';
import { useAccount, useChainId } from 'wagmi';
import { cowApiClient, OrderStatus } from './constants';
import { TokenForChain } from '../tokens/types';
import { ETH_ADDRESS, TRADE_TOKENS } from '../tokens/tokens.constants';
import { formatOrderStatus } from './formatOrderStatus';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

async function fetchEthereumTradeHistory(
  chainId: number,
  address?: string,
  limit = 50,
  tokens?: TokenForChain[]
): Promise<TradeHistory | undefined> {
  // no history on tenderly
  if (chainId === TENDERLY_CHAIN_ID) {
    return [];
  }
  if (!address) return [];

  const { data: ordersData, response } = await cowApiClient[chainId as keyof typeof cowApiClient].GET(
    '/api/v1/account/{owner}/orders',
    {
      params: {
        path: { owner: address },
        query: { limit }
      }
    }
  );

  if (!response.ok || !ordersData) {
    throw new Error(`Failed to fetch orders for ${address}: ${response.statusText}`);
  }

  const parsedOrders = ordersData
    .map(order => {
      const orderFromToken = tokens?.find(
        token => token.address?.toLowerCase() === order.sellToken.toLowerCase()
      );
      const fromToken =
        order.ethflowData && orderFromToken?.isWrappedNative
          ? tokens?.find(token => token.address?.toLowerCase() === ETH_ADDRESS.toLowerCase())
          : orderFromToken;
      const toToken = tokens?.find(token => token.address?.toLowerCase() === order.buyToken.toLowerCase());
      return {
        id: order.uid,
        blockTimestamp: new Date(order.creationDate),
        transactionHash: order.uid, // Not available but we can use orderId
        origin: order.owner,
        fromAmount: BigInt(
          order.status === OrderStatus.fulfilled ? order.executedSellAmount : order.sellAmount
        ),
        fromToken: { ...fromToken, id: fromToken?.address, address: fromToken?.address },
        toAmount: BigInt(order.status === OrderStatus.fulfilled ? order.executedBuyAmount : order.buyAmount),
        toToken: { ...toToken, id: toToken?.address, address: toToken?.address },
        module: ModuleEnum.TRADE,
        type: TransactionTypeEnum.TRADE,
        cowOrderStatus: formatOrderStatus(order.status as OrderStatus),
        chainId
      };
    })
    // Don't show history items for tokens we do not support
    .filter(order => !!order.fromToken.id && !!order.toToken.id);

  return parsedOrders as TradeHistory;
}

export function useEthereumTradeHistory({
  limit = 50,
  enabled = true
}: {
  limit?: number;
  enabled?: boolean;
}): ReadHook & { data?: TradeHistory } {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const tokens = TRADE_TOKENS[chainIdToUse as keyof typeof TRADE_TOKENS]
    ? Object.values(TRADE_TOKENS[chainIdToUse as keyof typeof TRADE_TOKENS])
    : [];

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(address) && enabled,
    queryKey: ['trade-history', address, limit, chainIdToUse],
    queryFn: () => fetchEthereumTradeHistory(chainIdToUse, address, limit, tokens)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'CoW Protocol API',
        href: 'https://docs.cow.fi/category/apis',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
