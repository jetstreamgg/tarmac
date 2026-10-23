import { ReadHook } from '../hooks';
import { ModuleEnum, TRUST_LEVELS, TransactionTypeEnum, TrustLevelEnum } from '../constants';
import { useQuery } from '@tanstack/react-query';
import { TradeHistory } from './trade';
import { useConnection, useChainId } from 'wagmi';
import { COW_API_ENDPOINT, OrderStatus } from './constants';
import type { paths } from './cowApiSchema';
import { TokenForChain } from '../tokens/types';
import { ETH_ADDRESS, getTokensForChain } from '../tokens/tokens.constants';
import { formatOrderStatus } from './formatOrderStatus';
import { isCowSupportedChainId } from '@/utils';
import { SKY_MONEY_APP_CODE } from './constants';
import { toReadHook } from '../shared/toReadHook';
import { fetchJson } from '../shared/fetchJson';

type UserOrders =
  paths['/api/v1/account/{owner}/orders']['get']['responses'][200]['content']['application/json'];

async function fetchCowswapTradeHistory(
  chainId: number,
  address?: string,
  limit = 50,
  tokens?: TokenForChain[]
): Promise<TradeHistory | undefined> {
  if (!address) return [];

  const endpoint = COW_API_ENDPOINT[chainId];
  if (!endpoint) {
    throw new Error(`CowSwap API not configured for chain ${chainId}`);
  }

  const ordersData = await fetchJson<UserOrders | null>(
    `${endpoint}/api/v1/account/${address}/orders?limit=${limit}`,
    { label: 'CowSwap orders', requireOk: true }
  );
  if (!Array.isArray(ordersData)) {
    throw new Error(`Failed to fetch orders for ${address}: unexpected response`);
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

  const query = useQuery({
    enabled: Boolean(address) && enabled && isCowSupported,
    queryKey: ['cowswap-trade-history', address, limit, chainId],
    queryFn: () => fetchCowswapTradeHistory(chainId, address, limit, tokens)
  });

  return toReadHook(query, [
    {
      title: 'CoW Protocol API',
      href: 'https://docs.cow.fi/category/apis',
      onChain: false,
      trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
    }
  ]);
}
