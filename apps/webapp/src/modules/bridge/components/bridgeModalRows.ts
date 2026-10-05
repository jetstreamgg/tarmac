/**
 * Pure cell builders for the "Review USDS bridge" modal grid (Figma 3574:64110):
 * [Bridge type | Bridge rate], [Estimated arrival | Slippage], [Bridge fee | Network fee].
 * Labels and pairing are the Figma contract, asserted in `bridgeModalRows.test.ts`.
 */

import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { networkFeeCell } from '@/components/product/ModalGridCells';
import { formatUsd } from '@/utils';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';

export const BRIDGE_TYPE_LABEL: Record<BridgeRouteKind, string> = {
  native: 'Native',
  cctp: 'CCTP',
  layerzero: 'LayerZero'
};

/** "~3 min", "~1 hr 30 min". */
export const formatEta = (minutes: number): string => {
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `~${hours} hr` : `~${hours} hr ${rest} min`;
};

export const formatSlippage = (slippage: number): string => `${(slippage * 100).toFixed(2)}%`;

export function buildBridgeModalRows({
  route,
  networkFee
}: {
  route: BridgeRoute;
  networkFee: string;
}): ModalGridCell[][] {
  return [
    [
      { kind: 'single', label: 'Bridge type', value: BRIDGE_TYPE_LABEL[route.kind] },
      { kind: 'pair', label: 'Bridge rate', token: 'USDS', left: '1.00', right: '1.00', rightToken: 'USDS' }
    ],
    [
      { kind: 'single', label: 'Estimated arrival', value: formatEta(route.etaMinutes) },
      { kind: 'single', label: 'Slippage', value: formatSlippage(route.slippage) }
    ],
    [
      { kind: 'single', label: 'Bridge fee', value: formatUsd(route.bridgeFeeUsd) },
      networkFeeCell(networkFee)
    ]
  ];
}
