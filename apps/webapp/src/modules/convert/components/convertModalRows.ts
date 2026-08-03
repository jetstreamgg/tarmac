/**
 * Pure cell builders for the "Review conversion" modal grid (Figma 1036:205509):
 * [Rate pair | Network], [Slippage | Fee], then Network fee full-width. Rate,
 * Slippage and Fee are PSM guarantees (1:1, no slippage, no fees) — the engine
 * disables the flow before review whenever mainnet tin/tout is non-zero, so the
 * static values can never lie. Which labels exist and how they pair is the
 * Figma contract, asserted in `convertModalRows.test.ts`.
 */

import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { NETWORK_FEE_LABEL } from '@/components/product/ModalGridCells';

export type ConvertModalRowInput = {
  /** Origin token symbol (e.g. "USDS") — icons the Rate pair's left side. */
  originSymbol: string;
  /** Target token symbol (e.g. "USDC") — icons the Rate pair's right side. */
  targetSymbol: string;
  /** Network the conversion runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the review screen: [Rate ◉1.00 = ◉1.00 | Network], [Slippage | Fee],
 * then Network fee.
 */
export function buildConvertModalRows(input: ConvertModalRowInput): ModalGridCell[][] {
  return [
    [
      {
        kind: 'pair',
        label: 'Rate',
        token: input.originSymbol,
        left: '1.00',
        right: '1.00',
        rightToken: input.targetSymbol
      },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      { kind: 'single', label: 'Slippage', value: '0.00%' },
      { kind: 'single', label: 'Fee', value: '$0.00' }
    ],
    [{ kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }]
  ];
}
