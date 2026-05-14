import { useMutation, useQuery } from '@tanstack/react-query';
import { useConnection, useChainId, useSignTypedData } from 'wagmi';
import { cowApiClient } from './constants';
import { WriteHookParams } from '../hooks';
import { fetchOrderStatus } from './fetchOrderStatus';
import { useCallback, useEffect, useState } from 'react';
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

  const [shouldRefetchOrderStatus, setShouldRefetchOrderStatus] = useState(true);

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
    // Refetches the order status every 2 seconds if the order is not filled
    refetchInterval: shouldRefetchOrderStatus ? 2000 : false,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (cancelledOrder?.status === 'fulfilled' || cancelledOrder?.status === 'cancelled') {
      setShouldRefetchOrderStatus(false);
      onSuccess(cancelledOrder, orderUids);
    }
  }, [cancelledOrder?.status]);

  const resetState = useCallback(() => {
    setShouldRefetchOrderStatus(true);
  }, []);

  useEffect(() => {
    // This effect will run when the component unmounts or when the order changes
    return () => {
      resetState();
    };
  }, [orderUids, resetState]);

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
