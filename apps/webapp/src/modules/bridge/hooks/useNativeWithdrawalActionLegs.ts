import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Call, Client } from 'viem';
import { useConfig, useReadContract } from 'wagmi';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { l2CrossDomainMessengerAbi, type OpStackNetworkId } from '../adapters/nativeDeposit/contracts';
import { opStackReplayGas } from '../adapters/nativeDeposit/opStack';
import { OP_STACK_WITHDRAWAL } from '../adapters/nativeWithdrawal/contracts';
import { opStackWithdrawalReplay, opStackWithdrawalReplayCall } from '../adapters/nativeWithdrawal/opStack';
import { opStackWithdrawalActionCall } from '../adapters/nativeWithdrawal/opStackActions';
import type { ChainReader } from '../adapters/types';
import type { PendingBridge } from '../model/types';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';
import { usePromptIssuers } from './usePromptIssuers';

export type OpStackWithdrawalLegAction = 'prove' | 'finalize' | 'replay';

/**
 * The Ethereum leg of an OP Stack withdrawal's next action. The prove and the
 * finalize are built from the chain when the leg is enabled (the prove's
 * storage proof, the finalize's passing check); the retry of a failed relay
 * replays the stored message on the L1 messenger at an explicit gas priced
 * from its baseGas, as the deposit's replay does. No call while it is
 * building or doesn't check out. Only enabled with the wallet on `chainId`,
 * as the simulation runs on the connected chain.
 */
export function useOpStackWithdrawalLegs({
  action,
  enabled,
  network,
  bridge,
  chainId,
  getCallbacks
}: {
  action: OpStackWithdrawalLegAction | undefined;
  enabled: boolean;
  network: OpStackNetworkId | undefined;
  bridge: Pick<PendingBridge, 'id' | 'txHash' | 'amount' | 'recipient' | 'account' | 'routeData'> | undefined;
  /** Ethereum (its Tenderly fork in dev). */
  chainId: number | undefined;
  getCallbacks: () => TxCallbacks;
}) {
  const config = useConfig();
  const { familyChainId } = usePendingScope();
  const portalAction = action === 'prove' || action === 'finalize' ? action : undefined;
  const built = useQuery({
    queryKey: [
      'op-stack-withdrawal-action',
      familyChainId,
      portalAction,
      network,
      bridge?.id,
      bridge?.txHash,
      bridge?.routeData
    ],
    queryFn: async () => {
      const context = wagmiAdapterContext(config, familyChainId);
      const l1 = context.getClient('ethereum');
      const l2 = context.getClient(network!);
      if (!l1 || !l2) throw new Error(`No client for ${network}`);
      return opStackWithdrawalActionCall({
        action: portalAction!,
        l1,
        l2: l2 as ChainReader & Client,
        network: network!,
        bridge: bridge!
      });
    },
    enabled: enabled && !!portalAction && !!network && !!bridge,
    refetchOnWindowFocus: false,
    retry: false,
    gcTime: 0
  });

  const replay = useMemo(() => {
    if (!enabled || action !== 'replay' || !network) return undefined;
    try {
      return { value: opStackWithdrawalReplay(network, bridge?.routeData) };
    } catch (error) {
      return { error: error as Error };
    }
  }, [enabled, action, network, bridge?.routeData]);
  const replayValue = replay?.value;
  const baseGas = useReadContract({
    address: network ? OP_STACK_WITHDRAWAL[network].l1Messenger : undefined,
    abi: l2CrossDomainMessengerAbi,
    functionName: 'baseGas',
    args: replayValue?.baseGasArgs,
    chainId,
    query: { enabled: !!replayValue && chainId !== undefined }
  });

  const calls = useMemo<Call[]>(() => {
    if (replayValue && network && baseGas.data !== undefined)
      return [
        opStackWithdrawalReplayCall({ network, args: replayValue.args, gas: opStackReplayGas(baseGas.data) })
      ];
    if (portalAction && built.data) {
      const { address, ...call } = built.data;
      return [{ to: address, ...call } as unknown as Call];
    }
    return [];
  }, [replayValue, network, baseGas.data, portalAction, built.data]);

  const { onMutate, issuerOf } = usePromptIssuers(getCallbacks);
  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate,
    onStart: (hash, variables) => issuerOf(variables).onStart(hash),
    onSuccess: (hash, blockNumber) => getCallbacks().onSuccess(hash, blockNumber),
    onError: (error, hash, variables) => issuerOf(variables).onError(error, hash)
  });

  return {
    /** Confirm can send the action. */
    ready: calls.length > 0 && flow.prepared,
    /** The build, the stored message, the baseGas read or the simulation failed. */
    error:
      (portalAction ? built.error : null) ??
      replay?.error ??
      (replayValue ? baseGas.error : null) ??
      (calls.length > 0 ? flow.error : null),
    execute: flow.execute,
    reset: flow.reset
  };
}
