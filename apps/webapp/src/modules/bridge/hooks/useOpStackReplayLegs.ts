import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  L2_CROSS_DOMAIN_MESSENGER,
  l2CrossDomainMessengerAbi,
  type OpStackNetworkId
} from '../adapters/nativeDeposit/contracts';
import { opStackReplay, opStackReplayCall, opStackReplayGas } from '../adapters/nativeDeposit/opStack';

/**
 * The replay leg of a deposit whose OP Stack relay failed: relayMessage on the
 * L2 messenger with the stored message, at an explicit gas priced from the
 * messenger's baseGas (the wallet's estimate stores the message as failed
 * again). No call while the message doesn't check out or baseGas is loading.
 * Only enabled with the wallet on `chainId`, as the simulation runs on the
 * connected chain.
 */
export function useOpStackReplayLegs({
  enabled,
  network,
  routeData,
  chainId,
  getCallbacks
}: {
  enabled: boolean;
  network: OpStackNetworkId | undefined;
  routeData: Record<string, string> | undefined;
  /** The L2 the replay is sent on (its Tenderly fork in dev). */
  chainId: number | undefined;
  getCallbacks: () => TxCallbacks;
}) {
  const replay = useMemo(() => {
    if (!enabled || !network) return undefined;
    try {
      return { value: opStackReplay(network, routeData) };
    } catch (error) {
      return { error: error as Error };
    }
  }, [enabled, network, routeData]);
  const value = replay?.value;

  const baseGas = useReadContract({
    address: L2_CROSS_DOMAIN_MESSENGER,
    abi: l2CrossDomainMessengerAbi,
    functionName: 'baseGas',
    args: value?.baseGasArgs,
    chainId,
    query: { enabled: !!value && chainId !== undefined }
  });

  const calls = useMemo(
    () =>
      value && baseGas.data !== undefined
        ? [opStackReplayCall({ args: value.args, gas: opStackReplayGas(baseGas.data) })]
        : [],
    [value, baseGas.data]
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
    /** Confirm can send the replay. */
    ready: calls.length > 0 && flow.prepared,
    /** The message, the baseGas read or the simulation failed. */
    error: replay?.error ?? (value ? baseGas.error : null) ?? (calls.length > 0 ? flow.error : null),
    execute: flow.execute,
    reset: flow.reset
  };
}
