import { isHash, type Hex } from 'viem';
import { QueryParams } from '@/lib/constants';
import { BRIDGE_NETWORKS } from '../../model/networks';
import { isSettled } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { isCctpL2Network, type CctpL2NetworkId } from './contracts';

/** A link that opens the Bridge tab and looks up the CCTP burn `txHash` on `from`. */
export const cctpClaimLink = (origin: string, from: CctpL2NetworkId, txHash: Hex): string => {
  const url = new URL('/convert', origin);
  url.searchParams.set(QueryParams.Tab, 'bridge');
  url.searchParams.set(QueryParams.ClaimNetwork, from);
  url.searchParams.set(QueryParams.ClaimTx, txHash);
  return url.toString();
};

/** The burn a claim link names, or undefined when its params are missing or invalid. */
export function readCctpClaimLink(
  params: URLSearchParams
): { from: CctpL2NetworkId; txHash: Hex } | undefined {
  const network = BRIDGE_NETWORKS.find(({ id }) => id === params.get(QueryParams.ClaimNetwork))?.id;
  const tx = params.get(QueryParams.ClaimTx);
  if (!network || !isCctpL2Network(network) || !tx || !isHash(tx)) return undefined;
  return { from: network, txHash: tx.toLowerCase() as Hex };
}

/** The claim link of a CCTP bridge to Ethereum still to be claimed, to share or keep. */
export const pendingClaimLink = (origin: string, bridge: PendingBridge): string | undefined =>
  bridge.routeKind === 'cctp' &&
  bridge.to === 'ethereum' &&
  isCctpL2Network(bridge.from) &&
  bridge.nextAction === 'claim' &&
  !isSettled(bridge) &&
  bridge.txHash
    ? cctpClaimLink(origin, bridge.from, bridge.txHash as Hex)
    : undefined;
