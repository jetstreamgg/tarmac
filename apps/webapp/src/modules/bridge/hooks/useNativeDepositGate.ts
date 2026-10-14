import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import {
  ARBITRUM_DEPOSIT,
  OP_STACK_DEPOSIT,
  isNativeDepositNetwork,
  l1BridgeIsOpenAbi
} from '../adapters/nativeDeposit/contracts';
import type { BridgeNetworkId } from '../model/networks';
import { toRouteFact, type BridgeRouteFacts } from '../model/resolveRoute';

/**
 * Whether the L1 bridge to `to` takes new deposits, as a route fact; undefined
 * when the pair is not a native deposit from Ethereum. In-flight bridges don't
 * depend on it: only the L1 deposit checks the switch.
 */
export function useNativeDepositGate({
  from,
  to,
  chainId
}: {
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  /** The Ethereum chain the deposit is sent on (the Tenderly fork in dev). */
  chainId: number | undefined;
}): BridgeRouteFacts['native'] {
  const network = from === 'ethereum' && isNativeDepositNetwork(to) ? to : undefined;
  const { status, data } = useReadContract({
    chainId,
    address:
      network === undefined
        ? undefined
        : network === 'arbitrum'
          ? ARBITRUM_DEPOSIT.l1Gateway
          : OP_STACK_DEPOSIT[network].l1TokenBridge,
    abi: l1BridgeIsOpenAbi,
    functionName: 'isOpen',
    query: { enabled: network !== undefined && chainId !== undefined, refetchInterval: 60_000 }
  });
  // Any value but exactly 1 is closed.
  return useMemo(
    () =>
      network === undefined
        ? undefined
        : toRouteFact({ status, data: data === undefined ? undefined : { isOpen: data === 1n } }),
    [network, status, data]
  );
}
