import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Call, Client } from 'viem';
import { useConfig, useReadContract } from 'wagmi';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  isOpStackNetwork,
  l2CrossDomainMessengerAbi,
  type NativeDepositNetwork
} from '../adapters/nativeDeposit/contracts';
import { opStackReplayGas } from '../adapters/nativeDeposit/opStack';
import { OP_STACK_WITHDRAWAL } from '../adapters/nativeWithdrawal/contracts';
import {
  opStackRelayFailed,
  opStackWithdrawalReplay,
  opStackWithdrawalReplayCall
} from '../adapters/nativeWithdrawal/opStack';
import { arbitrumExecuteFromChain } from '../adapters/nativeWithdrawal/arbitrumProgress';
import { opStackWithdrawalActionCall } from '../adapters/nativeWithdrawal/opStackActions';
import type { ChainReader } from '../adapters/types';
import type { PendingBridge } from '../model/types';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';
import { usePromptIssuers } from './usePromptIssuers';

export type NativeWithdrawalLegAction = 'prove' | 'finalize' | 'replay';

/**
 * The Ethereum leg of a native withdrawal's next action. The OP Stack prove
 * and finalize, and the Arbitrum outbox execute (its finalize), are built from
 * the chain when the leg is enabled (the prove's storage proof, the
 * finalize's passing check, the execute's outbox proof); an OP Stack retry of a failed relay
 * replays the stored message on the L1 messenger at an explicit gas priced
 * from its baseGas, as the deposit's replay does. No call while it is
 * building or doesn't check out. Only enabled with the wallet on `chainId`,
 * as the simulation runs on the connected chain.
 */
export function useNativeWithdrawalActionLegs({
  action,
  enabled,
  network,
  bridge,
  chainId,
  getCallbacks,
  onRelayFailed
}: {
  action: NativeWithdrawalLegAction | undefined;
  enabled: boolean;
  /** The L2 the withdrawal was sent from. */
  network: NativeDepositNetwork | undefined;
  bridge: PendingBridge | undefined;
  /** Ethereum (its Tenderly fork in dev). */
  chainId: number | undefined;
  getCallbacks: () => TxCallbacks;
  /** An OP Stack finalize mined but its L1 relay failed, so the funds wait for a replay. Called before onSuccess. */
  onRelayFailed?: () => void;
}) {
  const config = useConfig();
  const { familyChainId } = usePendingScope();
  const opStack = network && isOpStackNetwork(network) ? network : undefined;
  // Arbitrum's only action is the outbox execute, sent as its finalize.
  const portalAction = action === 'finalize' || (action === 'prove' && opStack) ? action : undefined;
  const built = useQuery({
    queryKey: [
      'native-withdrawal-action',
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
      return opStack
        ? opStackWithdrawalActionCall({
            action: portalAction!,
            l1,
            l2: l2 as ChainReader & Client,
            network: opStack,
            bridge: bridge!
          })
        : arbitrumExecuteFromChain({ l1, l2, bridge: bridge! });
    },
    enabled: enabled && !!portalAction && !!network && !!bridge,
    refetchOnWindowFocus: false,
    retry: false,
    gcTime: 0
  });

  const replay = useMemo(() => {
    if (!enabled || action !== 'replay' || !opStack) return undefined;
    try {
      return { value: opStackWithdrawalReplay(opStack, bridge?.routeData) };
    } catch (error) {
      return { error: error as Error };
    }
  }, [enabled, action, opStack, bridge?.routeData]);
  const replayValue = replay?.value;
  const baseGas = useReadContract({
    address: opStack ? OP_STACK_WITHDRAWAL[opStack].l1Messenger : undefined,
    abi: l2CrossDomainMessengerAbi,
    functionName: 'baseGas',
    args: replayValue?.baseGasArgs,
    chainId,
    query: { enabled: !!replayValue && chainId !== undefined }
  });

  const calls = useMemo<Call[]>(() => {
    if (replayValue && opStack && baseGas.data !== undefined)
      return [
        opStackWithdrawalReplayCall({
          network: opStack,
          args: replayValue.args,
          gas: opStackReplayGas(baseGas.data)
        })
      ];
    if (portalAction && built.data) {
      const { address, ...call } = built.data;
      return [{ to: address, ...call } as unknown as Call];
    }
    return [];
  }, [replayValue, opStack, baseGas.data, portalAction, built.data]);

  const { onMutate, issuerOf } = usePromptIssuers(getCallbacks);
  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate,
    onStart: (hash, variables) => issuerOf(variables).onStart(hash),
    onReceipt: ({ logs }) => {
      if (portalAction === 'finalize' && opStack && opStackRelayFailed(opStack, logs)) onRelayFailed?.();
    },
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
