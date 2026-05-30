import { useConnection, useChainId } from 'wagmi';
import { cowApiClient } from './constants';
import { OrderQuoteResponse } from './trade';
import { WriteHookParams } from '../hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchOrderStatus } from './fetchOrderStatus';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { gPv2SettlementAbi, gPv2SettlementAddress } from '../generated';

const createTradeOrder = async (order: OrderQuoteResponse, chainId: number) => {
  try {
    const { data: orderId, response } = await cowApiClient[chainId as keyof typeof cowApiClient].POST(
      '/api/v1/orders',
      {
        body: {
          sellToken: order.quote.sellToken,
          buyToken: order.quote.buyToken,
          receiver: order.from,
          sellAmount: order.quote.sellAmountToSign.toString(),
          buyAmount: order.quote.buyAmountToSign.toString(),
          validTo: order.quote.validTo,
          feeAmount: '0',
          kind: order.quote.kind,
          partiallyFillable: order.quote.partiallyFillable,
          sellTokenBalance: order.quote.sellTokenBalance,
          buyTokenBalance: order.quote.buyTokenBalance,
          signingScheme: order.quote.signingScheme,
          signature: '0x',
          quoteId: order.id,
          from: order.from,
          appData: order.quote.appData
        }
      }
    );

    if (!response.ok || !orderId) {
      throw new Error(`Failed to create order: ${response.statusText}`);
    }

    return orderId;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const useCreatePreSignTradeOrder = ({
  order,
  onMutate = () => null,
  onStart = () => null,
  onSuccess = () => null,
  onError = () => null,
  onTransactionError = () => null
}: Omit<WriteHookParams, 'onSuccess'> & {
  order: OrderQuoteResponse | null | undefined;
  onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => void;
  onTransactionError: (error: Error) => void;
}) => {
  const chainId = useChainId();
  const { address } = useConnection();

  // Tracks the most recent orderId we've already called execute() for.
  // Replaces a `shouldSendTransaction` flag-state to avoid setState-in-effect.
  const lastFiredOrderIdRef = useRef<string | null>(null);

  const { data: orderId, mutate: createOrder } = useMutation({
    mutationKey: ['create-cow-trade-order', order?.id],
    mutationFn: () => createTradeOrder(order!, chainId),
    onMutate,
    onSuccess: data => {
      onStart(data || '');
    },
    onError: err => {
      onError(err, '');
    }
  });

  const { execute, prepared } = useWriteContractFlow({
    address: gPv2SettlementAddress[chainId as keyof typeof gPv2SettlementAddress],
    abi: gPv2SettlementAbi,
    functionName: 'setPreSignature',
    args: [orderId! as `0x${string}`, true],
    chainId,
    enabled: !!orderId,
    onError: onTransactionError
  });

  const { data: createdOrder } = useQuery({
    enabled: !!orderId,
    queryKey: ['erc20-order-status', orderId],
    queryFn: () => fetchOrderStatus(orderId!, chainId),
    // Refetch every 2s until the order is fulfilled, then stop. Function form
    // derives polling from the latest data — no React state, no setState in
    // effect.
    refetchInterval: query => (query.state.data?.status === 'fulfilled' ? false : 2000),
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (createdOrder?.status === 'fulfilled') {
      onSuccess(BigInt(createdOrder.executedSellAmount), BigInt(createdOrder.executedBuyAmount));
    }
  }, [createdOrder?.status]);

  // Fire the on-chain setPreSignature exactly once per orderId, once the
  // write flow is prepared. Ref-guarded so it can't re-fire if `prepared`
  // toggles after the first execute().
  useEffect(() => {
    if (orderId && prepared && lastFiredOrderIdRef.current !== orderId) {
      lastFiredOrderIdRef.current = orderId;
      execute();
    }
  }, [orderId, prepared, execute]);

  // Note: no cleanup-on-order-change to reset lastFiredOrderIdRef. Resetting
  // it would re-fire execute() for any stale orderId still held in
  // useMutation's `data` (which persists across mutationKey changes until the
  // next mutate() call). Each new successful mutation produces a fresh
  // orderId, so ref !== orderId is enough to fire exactly once per order.

  return {
    execute: () => {
      if (order && address) {
        createOrder();
      }
    }
  };
};
