import { useCallback, useMemo } from 'react';
import type { Call, PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { arbitrumWithdrawalCalls } from '../adapters/nativeWithdrawal/arbitrum';
import type { NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { l2BridgeGateAbi, l2WithdrawalBridge } from '../adapters/nativeWithdrawal/contracts';
import { opStackWithdrawalCalls } from '../adapters/nativeWithdrawal/opStack';
import { isBlockedRecipient, toAddress } from '../model/recipient';
import { useBridgeCallLegs } from './useBridgeCallLegs';

/** The withdrawal leg's function, which the source recording keys on. */
export const nativeWithdrawalFunction = (from: NativeDepositNetwork) =>
  from === 'arbitrum' ? 'outboundTransfer' : 'bridgeERC20To';

/**
 * The source legs of a native withdrawal from an L2 to Ethereum: the approve
 * of L2 USDS to Sky's L2 bridge or gateway (it burns from the sender) when the
 * allowance is short, and the withdrawal. The bridge's switch and limit are
 * read again right before the send. Late prompts, bundles and Safe runs behave
 * as in `useBridgeCallLegs`.
 */
export function useNativeWithdrawalLegs({
  enabled,
  from: network,
  chainId,
  account,
  recipient,
  amount,
  isSafeApp,
  batch = false,
  batchPending,
  onCallsSent,
  getCallbacks
}: {
  enabled: boolean;
  from: NativeDepositNetwork;
  /** The L2 chain the withdrawal is sent on (its Tenderly fork in dev). */
  chainId: number | undefined;
  account: string | undefined;
  /** The Ethereum recipient; the sender when none was entered. */
  recipient: string | undefined;
  amount: bigint;
  /** Inside the Safe App a signed prompt returns a safeTxHash. */
  isSafeApp?: boolean;
  /** Bundle the legs when the wallet can: the user's batch setting, never for a Safe. */
  batch?: boolean;
  /** See `useBridgeCallLegs`. */
  batchPending?: boolean;
  /** The wallet accepted a bundle under this EIP-5792 id; called right before its `onStart`. */
  onCallsSent?: (id: string) => void;
  getCallbacks: () => TxCallbacks;
}) {
  const from = toAddress(account);
  const to = toAddress(recipient ?? account);
  const client = usePublicClient({ chainId });
  const { bridge, l2Usds } = l2WithdrawalBridge(network);
  const active = enabled && chainId !== undefined && !!from && !!to && !isBlockedRecipient(to) && amount > 0n;

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? l2Usds : undefined,
    owner: from,
    spender: bridge
  });

  const calls = useMemo((): Call[] => {
    if (!active || allowance.data === undefined) return [];
    const args = { allowance: allowance.data, amount, recipient: to! };
    return network === 'arbitrum'
      ? arbitrumWithdrawalCalls(args)
      : opStackWithdrawalCalls({ network, ...args });
  }, [active, network, allowance.data, amount, to]);

  // Governance can close the bridge or lower the limit after Review.
  const preflight = useCallback(
    async (gateClient: PublicClient) => {
      const [isOpen, maxWithdraws] = await Promise.all([
        gateClient.readContract({ address: bridge, abi: l2BridgeGateAbi, functionName: 'isOpen' }),
        gateClient.readContract({
          address: bridge,
          abi: l2BridgeGateAbi,
          functionName: 'maxWithdraws',
          args: [l2Usds]
        })
      ]);
      if (isOpen !== 1n) return new Error('The bridge is closed to new withdrawals.');
      if (amount > maxWithdraws) return new Error("The amount is over the bridge's withdrawal limit.");
      return undefined;
    },
    [bridge, l2Usds, amount]
  );
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client,
    from,
    sendFunctionName: nativeWithdrawalFunction(network),
    preflight,
    isSafeApp,
    batch,
    batchPending,
    onCallsSent: id => onCallsSent?.(id),
    // A cached allowance may predate an approve that mined before the switch.
    onAccountSwitch: () => {
      if (active) allowance.mutate();
    },
    getCallbacks
  });

  return {
    calls,
    needsApprove: calls.length > 1,
    /** The legs go out as one wallet bundle. */
    isBatch: legs.isBatch,
    /** Confirm can send the first leg. */
    ready: legs.ready,
    /** A leg of the last run is still out, after a close. */
    busy: legs.busy,
    /** A leg of this run mined: Retry resumes the rest. */
    legMined: legs.legMined,
    /** The allowance read or the first leg's simulation failed. */
    error: (active && allowance.error) || legs.error,
    execute: legs.execute,
    reset: legs.reset,
    stop: legs.stop,
    refetchAllowance: allowance.mutate
  };
}
