import { useMemo } from 'react';
import { encodeFunctionData, type Address } from 'viem';
import { useEstimateGas } from 'wagmi';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { ARB_RETRYABLE_TX, arbRetryableTxAbi } from '../adapters/nativeDeposit/contracts';
import {
  arbitrumRedeemGas,
  arbitrumRedeemTicket,
  arbitrumTicketCall,
  type ArbitrumTicketAction
} from '../adapters/nativeDeposit/arbitrum';

/**
 * The redeem or keepalive leg of a deposit whose Arbitrum ticket wasn't
 * auto-redeemed: ArbRetryableTx.redeem (or .keepalive) from the user's wallet,
 * at an explicit gas above the Arbitrum estimate (a redeem's runs the
 * scheduled retry), so the retry isn't sent with the bare minimum. No call while the ticket id is missing or the
 * estimate is loading. Only enabled with the wallet on `chainId`, as the
 * simulation runs on the connected chain.
 */
export function useArbitrumRedeemLegs({
  action = 'redeem',
  enabled,
  routeData,
  chainId,
  account,
  getCallbacks
}: {
  action?: ArbitrumTicketAction;
  enabled: boolean;
  routeData: Record<string, string> | undefined;
  /** Arbitrum (its Tenderly fork in dev). */
  chainId: number | undefined;
  account: Address | undefined;
  getCallbacks: () => TxCallbacks;
}) {
  const ticket = useMemo(() => {
    if (!enabled) return undefined;
    try {
      return { value: arbitrumRedeemTicket(routeData) };
    } catch (error) {
      return { error: error as Error };
    }
  }, [enabled, routeData]);
  const ticketId = ticket?.value;

  const estimate = useEstimateGas({
    to: ARB_RETRYABLE_TX,
    data: ticketId
      ? encodeFunctionData({ abi: arbRetryableTxAbi, functionName: action, args: [ticketId] })
      : undefined,
    account,
    chainId,
    query: { enabled: !!ticketId && !!account && chainId !== undefined }
  });

  const calls = useMemo(
    () =>
      ticketId && estimate.data !== undefined
        ? [arbitrumTicketCall({ action, ticketId, gas: arbitrumRedeemGas(estimate.data) })]
        : [],
    [action, ticketId, estimate.data]
  );

  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate: variables => getCallbacks().onMutate(variables),
    onStart: hash => getCallbacks().onStart(hash),
    onSuccess: (hash, blockNumber) => getCallbacks().onSuccess(hash, blockNumber),
    onError: (error, hash) => getCallbacks().onError(error, hash)
  });

  return {
    /** Confirm can send the call. */
    ready: calls.length > 0 && flow.prepared,
    /** The ticket, the estimate or the simulation failed. */
    error: ticket?.error ?? (ticketId ? estimate.error : null) ?? (calls.length > 0 ? flow.error : null),
    execute: flow.execute,
    reset: flow.reset
  };
}
