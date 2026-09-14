/**
 * Pure cell builders for the rewards supply/withdraw transaction modals. No
 * Figma comps exist for these flows (PR #1773 review note), so the grids adapt
 * the Savings modal shape (859:36036 entry / 859:36154 review) to the data
 * points the legacy rewards modal already displayed: Rate, Rewards in,
 * Est. earnings (1Y), Product, Withdrawal, Network fee. Which labels exist and
 * how they pair up is asserted in `rewardsModalRows.test.ts`; presentation
 * hints (`token`, `network`, `rateAccent`, …) map to the DS treatments in the
 * shared cell renderer.
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
export type RewardsModalCell = ModalGridCell;

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type RewardsModalGridRow = RewardsModalCell[];

const rewardsRateCell = (rate: string) => rateCell('Rate', rate, 'savings', 'str');

/** The "Rewards in" cell — the reward token's symbol, iconed. */
const rewardsInCell = (rewardsIn: string): ModalGridCell => ({
  kind: 'single',
  label: 'Rewards in',
  value: rewardsIn,
  token: rewardsIn
});

/** Display strings for the "Supply to {farm}" / "Withdraw from {farm}" entry grids. */
type RewardsEntryRowInput = EarnEntryRowInput & {
  /** Current reward rate, formatted (e.g. "4.50%"), or "–" for point farms. */
  rate: string;
  /** Symbol of the staked token for the Supply cell icon (USDS for every current farm). */
  supplyToken: string;
  /** Supply only: reward-token symbol for the "Rewards in" cell; omit for point farms (CLE). Ignored on withdraw. */
  rewardsIn?: string;
};

/**
 * Grid for the "Supply to {farm}" / "Withdraw from {farm}" entry screens — the
 * Savings entry shape with the farm's data points: [Rate | Network],
 * [Supply | Est. earnings (1Y)], then Network fee — paired with Rewards in on a
 * supply to a token farm, full-width otherwise. With no amount entered the
 * delta cells collapse to their current value; entering one draws the
 * before→after arrows. The rate is unchanged by a withdrawal, so it stays single.
 */
export function buildRewardsEntryRows(
  flow: 'supply' | 'withdraw',
  input: RewardsEntryRowInput
): RewardsModalGridRow[] {
  const rewardsIn = flow === 'supply' ? input.rewardsIn : undefined;
  return buildEarnEntryRows(input, {
    rate: rewardsRateCell(input.rate),
    supplyToken: input.supplyToken,
    feeCompanion: rewardsIn ? rewardsInCell(rewardsIn) : undefined
  });
}

/** Display strings for the "Review supply" stage. */
type RewardsSupplyReviewRowInput = EarnReviewRowInput & {
  /** 1Y projected earnings after the deposit, `$`-formatted, or "–" for point farms. */
  estEarnings: string;
  /** Product name (e.g. "SPK Rewards"). */
  product: string;
  /** Token symbol drawn in the Product cell's ringed iconbox (reward token, else the supply token). */
  productToken: string;
  /** Current reward rate, formatted, or "–". */
  rate: string;
  /** Reward-token symbol for the "Rewards in" cell; omit for point farms. */
  rewardsIn?: string;
};

/**
 * Grid for the "Review supply" stage — the Savings review shape with the farm's
 * data points: [Rewards in | Est. earnings (1Y)] (Est. earnings full-width on
 * point farms), [Product | Rate], [Withdrawal | Network], Network fee.
 */
export function buildRewardsSupplyReviewRows(input: RewardsSupplyReviewRowInput): RewardsModalGridRow[] {
  const estEarnings = estEarningsTrendCell(input.estEarnings);
  return buildEarnReviewRows(input, {
    leading: input.rewardsIn ? [rewardsInCell(input.rewardsIn), estEarnings] : [estEarnings],
    product: productCell(input.product, input.productToken, 'default'),
    rate: rewardsRateCell(input.rate)
  });
}

/** Display strings for the "Review withdrawal" stage. */
type RewardsWithdrawReviewRowInput = EarnReviewRowInput & {
  /** Amount you'll receive in the supply token, formatted (e.g. "9,999.99 USDS"). */
  youReceive: string;
  /** Supply-token symbol for the You'll receive icon. */
  receiveToken: string;
  /** 1Y projected earnings after the withdrawal, `$`-formatted, or "–". */
  estEarnings: string;
  /** Product name (e.g. "SPK Rewards"). */
  product: string;
  /** Token symbol drawn in the Product cell's ringed iconbox. */
  productToken: string;
  /** Current reward rate, formatted, or "–". */
  rate: string;
};

/**
 * Grid for the "Review withdrawal" stage — the Savings withdraw-review shape:
 * [You'll receive | Est. earnings (1Y)], [Product | Rate],
 * [Withdrawal | Network], Network fee.
 */
export function buildRewardsWithdrawReviewRows(input: RewardsWithdrawReviewRowInput): RewardsModalGridRow[] {
  return buildEarnReviewRows(input, {
    leading: [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: input.receiveToken },
      estEarningsTrendCell(input.estEarnings)
    ],
    product: productCell(input.product, input.productToken, 'default'),
    rate: rewardsRateCell(input.rate)
  });
}
