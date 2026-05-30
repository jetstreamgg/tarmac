import { useMutation, useQuery } from '@tanstack/react-query';
import { useConnection, useChainId, useSignTypedData } from 'wagmi';
import { cowApiClient } from './constants';
import { WriteHookParams } from '../hooks';
import { fetchOrderStatus } from './fetchOrderStatus';
import { useEffect } from 'react';
import { gPv2SettlementAddress } from '../generated';

const cancelOrders = async (orderUids: `0x${string}`[], signature: `0x${string}`, chainId: number) => {
  try {
    const { data, response } = await cowApiClient[chainId as keyof typeof cowApiClient].DELETE(
      '/api/v1/orders',
      {
        body: {
          orderUids,
          signature,
          signingScheme: 'eip712'
        }
      }
    );

    if (!response.ok || !orderUids) {
      throw new Error(
        `Failed to cancel order with IDs ${orderUids} on chain ${chainId}: ${response.statusText}`
      );
    }

    return {
      data,
      response
    };
  } catch (error) {
    console.error(error);
  }
};

export const useSignAndCancelOrder = ({
  orderUids,
  enabled: paramEnabled = true,
  onStart = () => null,
  onSuccess = () => null,
  onError = () => null
}: Omit<WriteHookParams, 'onSuccess'> & {
  orderUids: `0x${string}`[];
  // TODO fix any
  onSuccess: (data: any, orderUids: `0x${string}`[]) => void;
}) => {
  const chainId = useChainId();
  const { address } = useConnection();

  const { signTypedData, data: signature } = useSignTypedData({
    mutation: {
      onSuccess: signature => {
        mutate(signature);
      },
      onError: (err: Error) => {
        if (onError) {
          onError(err, signature || '');
        }
      }
    }
  });

  const { mutate, isSuccess: isOrderCancellationSent } = useMutation({
    mutationKey: ['cancel-order', orderUids],
    mutationFn: (signature: `0x${string}`) => cancelOrders(orderUids, signature, chainId),
    onSuccess: () => {
      if (onStart) {
        onStart('');
      }
    },
    onError: (err: Error) => {
      if (onError) {
        onError(err, '');
      }
    }
  });

  const { data: cancelledOrder } = useQuery({
    enabled: paramEnabled && orderUids?.length > 0 && isOrderCancellationSent,
    queryKey: ['cancel-order-status', orderUids[0]],
    queryFn: () => fetchOrderStatus(orderUids[0], chainId),
    // Refetch every 2s until the order is fulfilled or cancelled, then stop.
    // Function form derives polling from the latest data — no React state.
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'fulfilled' || status === 'cancelled' ? false : 2000;
    },
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (cancelledOrder?.status === 'fulfilled' || cancelledOrder?.status === 'cancelled') {
      onSuccess(cancelledOrder, orderUids);
    }
  }, [cancelledOrder?.status]);

  // When orderUids changes, useQuery's queryKey changes too, so it starts a
  // fresh query for the new uids — no explicit reset needed.

  return {
    execute: () => {
      if (orderUids.length > 0 && address) {
        signTypedData({
          domain: {
            name: 'Gnosis Protocol',
            version: 'v2',
            chainId,
            verifyingContract: gPv2SettlementAddress[chainId as keyof typeof gPv2SettlementAddress]
          },
          types: {
            OrderCancellations: [
              {
                name: 'orderUids',
                type: 'bytes[]'
              }
            ]
          },
          primaryType: 'OrderCancellations',
          message: {
            orderUids
          }
        });
      }
    },
    data: signature
  };
};
