/**
 * Pure cell builders for the "Review USDS bridge" modal grid (Figma 3574:64110):
 * [Bridge type | Bridge rate], [Estimated arrival | Slippage], [Bridge fee | Network fee].
 * Labels and pairing are the Figma contract, asserted in `bridgeModalRows.test.ts`.
 */

import { plural, t } from '@lingui/core/macro';
import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { networkFeeCell } from '@/components/product/ModalGridCells';
import { NO_VALUE } from '@/lib/constants';
import { formatUsd } from '@/utils';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';

// CCTP and LayerZero are protocol names.
export const bridgeTypeLabel = (kind: BridgeRouteKind): string =>
  kind === 'native' ? t`Native` : kind === 'cctp' ? 'CCTP' : 'LayerZero';

const DAY_MINUTES = 24 * 60;

/** Whole or one-decimal days, for multi-day withdrawals: 7, 6.4. */
export const toDays = (minutes: number): number => Math.round((minutes / DAY_MINUTES) * 10) / 10;

/** "~3 min", "~1 hr 30 min", "~1 day", "~7 days". */
export const formatEta = (minutes: number): string => {
  if (minutes >= DAY_MINUTES) return plural(toDays(minutes), { one: '~# day', other: '~# days' });
  if (minutes < 60) return t`~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t`~${hours} hr` : t`~${hours} hr ${rest} min`;
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
      { kind: 'single', label: t`Bridge type`, value: bridgeTypeLabel(route.kind) },
      { kind: 'pair', label: t`Bridge rate`, token: 'USDS', left: '1.00', right: '1.00', rightToken: 'USDS' }
    ],
    [
      { kind: 'single', label: t`Estimated arrival`, value: formatEta(route.etaMinutes) },
      { kind: 'single', label: t`Slippage`, value: formatSlippage(route.slippage) }
    ],
    [
      {
        kind: 'single',
        label: t`Bridge fee`,
        value: route.bridgeFeeUsd === undefined ? NO_VALUE : formatUsd(route.bridgeFeeUsd)
      },
      networkFeeCell(networkFee)
    ]
  ];
}
