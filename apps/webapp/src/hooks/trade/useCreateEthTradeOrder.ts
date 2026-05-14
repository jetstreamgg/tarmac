import { useConnection, useChainId, useTransactionReceipt } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { ethFlowAbi, ethFlowAddress } from '../generated';
import { OrderQuoteResponse } from './trade';
import { useCallback, useEffect, useState } from 'react';
import { getOrderId } from './getOrderId';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderStatus } from './fetchOrderStatus';

export const useCreateEthTradeOrder = ({
  order,
  gas,
  onMutate = () => null,
  onStart = () => null,
  onEthSent = () => null,
  onOrderCreated = () => null,
  onSuccess = () => null,
  onError = () => null,
  enabled: ethFlowEnabled = true
}: Omit<WriteHookParams, 'onSuccess'> & {
  order: OrderQuoteResponse | null | undefined;
  onEthSent: () => void;
  onOrderCreated: (orderId: string) => void;
  onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => void;
}): WriteHook => {
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | undefined>(undefined);
  const [shouldRefetchOrderStatus, setShouldRefetchOrderStatus] = useState(true);

  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const enabled = isConnected && ethFlowEnabled && !!order && !!connectedAddress;

  const ethFlowOrder = enabled
    ? {
        buyToken: order.quote.buyToken,
        receiver: connectedAddress,
        sellAmount: order.quote.sellAmountToSign,
        buyAmount: order.quote.buyAmountToSign,
        appData: order.quote.appDataHash,
        feeAmount: 0n,
        validTo: order.quote.validTo,
        partiallyFillable: order.quote.partiallyFillable,
        quoteId: BigInt(order.id)
      }
    : undefined;

  const handleOnChainTransactionSuccess = (txHash: string) => {
    setTransactionHash(txHash as `0x${string}`);
    onEthSent();
  };

  const { data: txReceipt } = useTransactionReceipt({
    hash: transactionHash,
    chainId,
    scopeKey: `transactionReceipt-ethFlowOrder-${order?.id}-${chainId}`
  });

  const orderId = getOrderId(txReceipt, chainId);

  const { data: createdOrder } = useQuery({
    enabled: !!orderId,
    queryKey: ['ethflow-order-status', orderId],
    queryFn: () => fetchOrderStatus(orderId!, chainId),
    // Refetches the order status every 2 seconds if the order is not filled
    refetchInterval: shouldRefetchOrderStatus ? 2000 : false,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    if (createdOrder?.status === 'open') {
      onOrderCreated(createdOrder.uid);
    }

    if (createdOrder?.status === 'fulfilled') {
      setShouldRefetchOrderStatus(false);
      onSuccess(BigInt(createdOrder.executedSellAmount), BigInt(createdOrder.executedBuyAmount));
    }
  }, [createdOrder?.status]);

  const resetState = useCallback(() => {
    setTransactionHash(undefined);
    setShouldRefetchOrderStatus(true);
  }, []);

  useEffect(() => {
    // This effect will run when the component unmounts or when the order changes
    return () => {
      resetState();
    };
  }, [order, resetState]);

  return useWriteContractFlow({
    address: ethFlowAddress[chainId as keyof typeof ethFlowAddress],
    abi: ethFlowAbi,
    functionName: 'createOrder',
    args: [ethFlowOrder!],
    value: order?.quote.sellAmountToSign,
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess: handleOnChainTransactionSuccess,
    onError,
    onStart
  });
};
