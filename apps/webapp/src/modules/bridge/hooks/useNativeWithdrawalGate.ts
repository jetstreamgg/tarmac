import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { isNativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { l2BridgeGateAbi, l2WithdrawalBridge } from '../adapters/nativeWithdrawal/contracts';
import type { BridgeNetworkId } from '../model/networks';
import { toRouteFact, type BridgeRouteFacts } from '../model/resolveRoute';

/**
 * Whether the L2 bridge of `from` takes new withdrawals and up to how much,
 * as a route fact; undefined when the pair is not a native withdrawal to
 * Ethereum. In-flight withdrawals don't depend on it: only the L2 send checks it.
 */
export function useNativeWithdrawalGate({
  from,
  to,
  chainId
}: {
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  /** The L2 chain the withdrawal is sent on (its Tenderly fork in dev). */
  chainId: number | undefined;
}): BridgeRouteFacts['native'] {
  const network = to === 'ethereum' && isNativeDepositNetwork(from) ? from : undefined;
  const { bridge, l2Usds } = network === undefined ? {} : l2WithdrawalBridge(network);
  const query = { enabled: network !== undefined && chainId !== undefined, refetchInterval: 60_000 };
  const isOpen = useReadContract({
    chainId,
    address: bridge,
    abi: l2BridgeGateAbi,
    functionName: 'isOpen',
    query
  });
  const maxWithdraws = useReadContract({
    chainId,
    address: bridge,
    abi: l2BridgeGateAbi,
    functionName: 'maxWithdraws',
    args: l2Usds === undefined ? undefined : [l2Usds],
    query
  });
  // Any value but exactly 1 is closed; one unread fact blocks.
  return useMemo(() => {
    if (network === undefined) return undefined;
    const data =
      isOpen.data === undefined || maxWithdraws.data === undefined
        ? undefined
        : { isOpen: isOpen.data === 1n, maxAmount: maxWithdraws.data };
    // A failed refetch keeps its last good read: a blip must not move an open Review off SkyLink.
    const status = data
      ? 'success'
      : [isOpen.status, maxWithdraws.status].includes('error')
        ? 'error'
        : 'pending';
    return toRouteFact({ status, data });
  }, [network, isOpen.status, isOpen.data, maxWithdraws.status, maxWithdraws.data]);
}
