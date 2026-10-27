import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { isCctpL2Network } from '../adapters/cctp/contracts';
import {
  cctpDestinationGateReads,
  cctpGate,
  cctpPocketUsdcRead,
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
  const split = network === undefined ? 0 : cctpSourceGateReads(network).length;
  // PSM3 swaps out the USDC its pocket holds, so its balance waits for the pocket.
  const pocket = (data as readonly unknown[] | undefined)?.[split - 1] as Address | undefined;
  const pocketContracts = useMemo(
    () =>
      network === undefined || pocket === undefined
        ? []
        : [{ ...cctpPocketUsdcRead(network, pocket), chainId: sourceChainId }],
    [network, pocket, sourceChainId]
  );
  const { status: pocketStatus, data: pocketData } = useReadContracts({
    allowFailure: false,
    contracts: pocketContracts,
    query: { enabled: pocketContracts.length > 0, refetchInterval: 60_000 }
  });
  return useMemo(() => {
    if (network === undefined) return undefined;
    const results = data as readonly unknown[] | undefined;
    const pocketUsdc = (pocketData as readonly bigint[] | undefined)?.[0];
    const reads =
      results && pocketUsdc !== undefined
        ? toCctpGateReads(
            results.slice(0, split) as unknown as CctpSourceResults,
            pocketUsdc,
            results.slice(split) as unknown as CctpDestinationResults
          )
        : undefined;
    const fetched = status === 'error' || pocketStatus === 'error' ? 'error' : reads ? 'success' : 'pending';
    return toRouteFact({ status: fetched, data: reads && cctpGate(reads, { swap }) });
  }, [network, status, data, pocketStatus, pocketData, split, swap]);
}
