import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { isCctpL2Network } from '../adapters/cctp/contracts';
import {
  cctpDestinationGateReads,
  cctpGate,
  cctpSourceGateReads,
  toCctpGateReads,
  type CctpDestinationResults,
  type CctpSourceResults
} from '../adapters/cctp/gate';
import type { BridgeNetworkId } from '../model/networks';
import { isLivePair } from '../model/pairs';
import { toRouteFact, type BridgeRouteFacts } from '../model/resolveRoute';

/**
 * CCTP's gate from an L2 to Ethereum, as a route fact; undefined when the pair
 * is not a live CCTP pair. Reads stay off until the pair goes live.
 */
export function useCctpGate({
  from,
  to,
  sourceChainId,
  ethereumChainId,
  swap = true
}: {
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  sourceChainId: number | undefined;
  /** The Ethereum chain the claim is sent on (the Tenderly fork in dev). */
  ethereumChainId: number | undefined;
  /** False for a burn of USDC already swapped, which needs no PSM3 liquidity. */
  swap?: boolean;
}): BridgeRouteFacts['cctp'] {
  const network = to === 'ethereum' && isCctpL2Network(from) && isLivePair({ from, to }) ? from : undefined;
  const contracts = useMemo(
    () =>
      network === undefined
        ? []
        : [
            ...cctpSourceGateReads(network).map(read => ({ ...read, chainId: sourceChainId })),
            ...cctpDestinationGateReads.map(read => ({ ...read, chainId: ethereumChainId }))
          ],
    [network, sourceChainId, ethereumChainId]
  );
  const { status, data } = useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: network !== undefined && sourceChainId !== undefined && ethereumChainId !== undefined,
      refetchInterval: 60_000
    }
  });
  return useMemo(() => {
    if (network === undefined) return undefined;
    const results = data as readonly unknown[] | undefined;
    const split = cctpSourceGateReads(network).length;
    const reads =
      results &&
      toCctpGateReads(
        network,
        results.slice(0, split) as unknown as CctpSourceResults,
        results.slice(split) as unknown as CctpDestinationResults
      );
    return toRouteFact({ status, data: reads && cctpGate(reads, { swap }) });
  }, [network, status, data, swap]);
}
