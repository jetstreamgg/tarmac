/**
 * Pure cell builders for the Savings transaction modals (Figma 859:36036 entry /
 * 859:36154 review). The redesigned modals lay their details out as a two-column
 * grid — each row is one or two labelled cells split by a hairline — so the
 * builders emit rows of *cells*, not flat label/value lines. Which labels exist,
 * how they pair up, and which are single-value vs before→after is the Figma
 * contract and is asserted in `savingsModalRows.test.ts`. Presentation hints
 * (`token`, `network`, `rateAccent`, …) are semantic — the modal body maps them
 * to the DS treatments (12px token icons, the chain icon, the savings-green %).
 */

import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { estEarningsTrendCell, productCell, rateCell } from '@/components/product/ModalGridCells';
import {
  buildEarnEntryRows,
  buildEarnReviewRows,
  type EarnEntryRowInput,
  type EarnReviewRowInput
} from '@/components/product/earnModalRows';

/** One labelled grid cell — the shared modal-grid cell model (single or before→after delta). */
export type SavingsModalCell = ModalGridCell;

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type SavingsModalGridRow = SavingsModalCell[];

const savingsRateCell = (label: string, rate: string) => rateCell(label, rate, 'savings', 'ssr');

/** Display strings for the Sky Savings entry screens (Figma 859:36036 supply / its withdraw mirror). */
type SavingsEntryRowInput = EarnEntryRowInput & {
  /** Current savings rate, formatted (e.g. "6.50%"). */
  savingsRate: string;
  /**
   * L2 PSM supply only: the slippage floor ("Receive at least" min sUSDS out),
   * formatted (e.g. "4.95 sUSDS"). Omitted on mainnet — Figma draws mainnet only,
   * so this cell is added "in the spirit of the design" for the L2 swap.
   * Ignored on withdraw.
   */
  minReceived?: string;
};

/**
 * Grid for the Sky Savings entry screens — supply (Figma 859:36036 empty /
 * 859:36088 filled) and its withdraw mirror: [Savings rate | Network],
 * [Supply | Est. earnings (1Y)], then Network fee full-width. With no amount
 * entered the delta cells collapse to their current value (859:36036);
 * entering one draws the before→after arrows (859:36088). On an L2 supply,
 * `minReceived` pairs into the last row to surface the PSM slippage floor.
 * The rate is unchanged by a withdrawal, so it stays a single value (the old
 * flat design drew it as a no-op delta).
 */
export function buildSavingsEntryRows(
  flow: 'supply' | 'withdraw',
  input: SavingsEntryRowInput
): SavingsModalGridRow[] {
  const minReceived = flow === 'supply' ? input.minReceived : undefined;
  return buildEarnEntryRows(input, {
    rate: savingsRateCell('Savings rate', input.savingsRate),
    supplyToken: 'USDS',
    earningsToken: 'USDS',
    feeCompanion: minReceived
      ? { kind: 'single', label: 'Receive at least', value: minReceived, token: 'sUSDS' }
      : undefined
  });
}

/** Display strings for the "Review supply" stage (Figma 859:36154). */
type SupplyReviewRowInput = EarnReviewRowInput & {
  /** sUSDS you'll receive, formatted (e.g. "9,999.99 sUSDS"). */
  youReceive: string;
  /** 1Y projected earnings on the position the supply leaves behind, formatted. */
  estEarnings: string;
  /** Product name (e.g. "Sky Savings"). */
  product: string;
  /** Current savings rate, formatted (e.g. "3.75%"). */
  rate: string;
};

/**
 * Grid for the "Review supply" stage (Figma 859:36154): [You'll receive |
 * Est. earnings (1Y)], [Product | Rate], [Withdrawal | Network], then Network
 * fee full-width.
 */
export function buildSupplyReviewRows(input: SupplyReviewRowInput): SavingsModalGridRow[] {
  return buildEarnReviewRows(input, {
    leading: [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: 'sUSDS' },
      // The projection is USDS-denominated whatever you supplied — name it, as
      // the vault and stUSDS reviews do.
      estEarningsTrendCell(input.estEarnings, 'USDS')
    ],
    product: productCell(input.product, 'sUSDS', 'default'),
    rate: savingsRateCell('Rate', input.rate)
  });
}

/** Display strings for the "Review withdrawal" stage (Figma 859:36322). */
type WithdrawReviewRowInput = EarnReviewRowInput & {
  /** Amount you'll receive in the destination token, formatted (e.g. "9,999.99 USDS"). */
  youReceive: string;
  /** Destination token symbol for the You'll receive icon. */
  receiveToken: string;
  /** 1Y projected earnings on the position the withdrawal leaves behind, formatted. */
  estEarnings: string;
  /** Product name (e.g. "Sky Savings"). */
  product: string;
  /** Current savings rate, formatted. */
  rate: string;
};

/**
 * Grid for the "Review withdrawal" stage (Figma 859:36322) — the supply
 * review's shape: [You'll receive | Est. earnings (1Y)], [Product | Rate],
 * [Withdrawal | Network], then Network fee full-width.
 */
export function buildWithdrawReviewRows(input: WithdrawReviewRowInput): SavingsModalGridRow[] {
  return buildEarnReviewRows(input, {
    leading: [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: input.receiveToken },
      estEarningsTrendCell(input.estEarnings, 'USDS')
    ],
    product: productCell(input.product, 'sUSDS', 'default'),
    rate: savingsRateCell('Rate', input.rate)
  });
}
