import { useConnection, useChainId } from 'wagmi';
import { cowApiClient } from './constants';
import { OrderQuoteResponse } from './trade';
import { WriteHookParams } from '../hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
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

  const [shouldRefetchOrderStatus, setShouldRefetchOrderStatus] = useState(true);
  const [shouldSendTransaction, setShouldSendTransaction] = useState(false);

  const { data: orderId, mutate: createOrder } = useMutation({
    mutationKey: ['create-cow-trade-order', order?.id],
    mutationFn: () => createTradeOrder(order!, chainId),
    onMutate,
    onSuccess: data => {
      onStart(data || '');
      setShouldSendTransaction(true);
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
    // Refetches the order status every 2 seconds if the order is not filled
    refetchInterval: shouldRefetchOrderStatus ? 2000 : false,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (createdOrder?.status === 'fulfilled') {
      setShouldRefetchOrderStatus(false);
      onSuccess(BigInt(createdOrder.executedSellAmount), BigInt(createdOrder.executedBuyAmount));
    }
  }, [createdOrder?.status]);

  useEffect(() => {
    if (shouldSendTransaction && prepared) {
      execute();
      setShouldSendTransaction(false);
    }
  }, [shouldSendTransaction, prepared]);

  const resetState = useCallback(() => {
    setShouldRefetchOrderStatus(true);
    setShouldSendTransaction(false);
  }, []);

  useEffect(() => {
    // This effect will run when the component unmounts or when the order changes
    return () => {
      resetState();
    };
  }, [order, resetState]);

  return {
    execute: () => {
      if (order && address) {
        createOrder();
      }
    }
  };
};
