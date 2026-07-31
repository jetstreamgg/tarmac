/**
 * Pure cell builders for the "Upgrade DAI/MKR" modal entry grid (Figma
 * 1310:130712 DAI / 1310:130760 MKR): [Rate | You'll receive], [Penalty ⓘ |
 * Network] (the penalty cell is MKR-only — the DAI comp also draws it, but the
 * delayed-upgrade penalty only exists on MKR→SKY, so drawing "4%" on a
 * penalty-free DAI upgrade would be wrong data), then Network fee full-width.
 * Which labels exist and how they pair is the Figma contract, asserted in
 * `upgradeModalRows.test.ts`.
 */

import type { ReactNode } from 'react';
import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { NETWORK_FEE_LABEL } from '@/components/product/ModalGridCells';

/** Display strings for the upgrade entry grid. */
export type UpgradeModalRowInput = {
  /** Source token symbol ("DAI" | "MKR") — icons the Rate pair's left side. */
  sourceToken: string;
  /** Target token symbol ("USDS" | "SKY") — icons the Rate pair's right side and You'll receive. */
  targetToken: string;
  /** Target units per 1 source unit, formatted (e.g. "1.00", "24,000.00"). */
  targetRate: string;
  /** Amount received after the upgrade, formatted. */
  receiveAmount: string;
  /** MKR only: the delayed-upgrade penalty, formatted (e.g. "4.00%"). Omit for DAI. */
  penalty?: string;
  /** Info popover trigger after the Penalty label (`PopoverRateInfo`). */
  penaltyInfo?: ReactNode;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the upgrade entry screen: [Rate ◉1.00 = ◉rate | You'll receive],
 * [Penalty ⓘ | Network] (MKR) or [Network] (DAI), then Network fee.
 */
export function buildUpgradeModalRows(input: UpgradeModalRowInput): ModalGridCell[][] {
  const network: ModalGridCell = { kind: 'single', label: 'Network', value: input.network, network: true };
  return [
    [
      {
        kind: 'pair',
        label: 'Rate',
        token: input.sourceToken,
        left: '1.00',
        right: input.targetRate,
        rightToken: input.targetToken
      },
      { kind: 'single', label: "You'll receive", value: input.receiveAmount, token: input.targetToken }
    ],
    input.penalty !== undefined
      ? [{ kind: 'single', label: 'Penalty', value: input.penalty, labelAction: input.penaltyInfo }, network]
      : [network],
    [{ kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }]
  ];
}
