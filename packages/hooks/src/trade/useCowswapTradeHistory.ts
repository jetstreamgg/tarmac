import { ReadHook } from '../hooks';
import { ModuleEnum, TRUST_LEVELS, TransactionTypeEnum, TrustLevelEnum } from '../constants';
import { useQuery } from '@tanstack/react-query';
import { TradeHistory } from './trade';
import { useConnection, useChainId } from 'wagmi';
import { cowApiClient, OrderStatus } from './constants';
import { TokenForChain } from '../tokens/types';
import { ETH_ADDRESS, getTokensForChain } from '../tokens/tokens.constants';
import { formatOrderStatus } from './formatOrderStatus';
import { isCowSupportedChainId } from '@jetstreamgg/sky-utils';
import { SKY_MONEY_APP_CODE } from './constants';

async function fetchCowswapTradeHistory(
  chainId: number,
  address?: string,
  limit = 50,
  tokens?: TokenForChain[]
): Promise<TradeHistory | undefined> {
  if (!address) return [];

  // Check if we have a client configured for this chain
  if (!cowApiClient[chainId as keyof typeof cowApiClient]) {
    throw new Error(`CowSwap API client not configured for chain ${chainId}`);
  }

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

      let appCode: string | undefined;
      if (order.fullAppData) {
        try {
          const appData = JSON.parse(order.fullAppData);
          appCode = appData.appCode;
        } catch (e) {
          // If parsing fails, leave appCode undefined
          console.error('Error parsing appData', e);
        }
      }

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
        chainId,
        appCode
      };
    })
    // Don't show history items for tokens we do not support or trades not from sky.money
    .filter(order => !!order.fromToken.id && !!order.toToken.id && order.appCode === SKY_MONEY_APP_CODE);

  return parsedOrders as TradeHistory;
}

export function useCowswapTradeHistory({
  limit = 50,
  enabled = true,
  chainId: providedChainId
}: {
  limit?: number;
  enabled?: boolean;
  chainId?: number;
} = {}): ReadHook & { data?: TradeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();

  const chainId = providedChainId ?? currentChainId;

  const isCowSupported = isCowSupportedChainId(chainId);

  const tokens = getTokensForChain(chainId);

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(address) && enabled && isCowSupported,
    queryKey: ['cowswap-trade-history', address, limit, chainId],
    queryFn: () => fetchCowswapTradeHistory(chainId, address, limit, tokens)
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
