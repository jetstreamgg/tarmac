import { useConnection, useChainId, useSignTypedData } from 'wagmi';
import { ORDER_TYPE_FIELDS, cowApiClient } from './constants';
import { OrderQuoteResponse } from './trade';
import { WriteHookParams } from '../hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchOrderStatus } from './fetchOrderStatus';
import { gPv2SettlementAddress } from '../generated';

const createTradeOrder = async (order: OrderQuoteResponse, signature: `0x${string}`, chainId: number) => {
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
          signature,
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

export const useSignAndCreateTradeOrder = ({
  order,
  onStart = () => null,
  onSuccess = () => null,
  onError = () => null
}: Omit<WriteHookParams, 'onSuccess'> & {
  order: OrderQuoteResponse | null | undefined;
  onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => void;
}) => {
  const chainId = useChainId();
  const { address } = useConnection();

  const { signTypedData, data: signature } = useSignTypedData({
    mutation: {
      onSuccess: signature => {
        createOrder(signature);
      },
      onError: (err: Error) => {
        if (onError) {
          onError(err, signature || '');
        }
      }
    }
  });

  const { data: orderId, mutate: createOrder } = useMutation({
    mutationKey: ['create-cow-trade-order', order?.id],
    mutationFn: (signature: `0x${string}`) => createTradeOrder(order!, signature, chainId),
    onSuccess: data => {
      onStart(data || '');
    },
    onError: err => {
      onError(err, '');
    }
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

  // When `order` changes, useQuery's queryKey (keyed on the resulting orderId)
  // changes too, so it starts a fresh query for the new order — no explicit
  // reset needed.

  return {
    execute: () => {
      if (order && address) {
        signTypedData({
          domain: {
            name: 'Gnosis Protocol',
            version: 'v2',
            chainId,
            verifyingContract: gPv2SettlementAddress[chainId as keyof typeof gPv2SettlementAddress]
          },
          types: {
            Order: ORDER_TYPE_FIELDS
          },
          primaryType: 'Order',
          message: {
            sellToken: order.quote.sellToken,
            buyToken: order.quote.buyToken,
            receiver: address,
            sellAmount: order.quote.sellAmountToSign,
            buyAmount: order.quote.buyAmountToSign,
            validTo: order.quote.validTo,
            appData: order.quote.appDataHash,
            feeAmount: 0n,
            kind: order.quote.kind,
            partiallyFillable: order.quote.partiallyFillable,
            sellTokenBalance: order.quote.sellTokenBalance,
            buyTokenBalance: order.quote.buyTokenBalance
          }
        });
      }
    },
    data: signature
  };
};
