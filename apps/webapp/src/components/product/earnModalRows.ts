/**
 * The grid layouts every earn family's transaction modals share (Figma
 * 859:36036 / 859:38105 entries, 859:36154 / 859:38553 reviews). The savings,
 * rewards, vault and stUSDS row builders differ only in the cells they put in
 * the product-specific slots — the rate cell's label/accent/explainer, the
 * value-icon tokens, the review's leading row, and an optional cell paired
 * left of Network fee — so they hand those in and this file owns the rows.
 * The per-module builders keep their own input types and tests; the row
 * shapes below are the contract those tests assert.
 */

import {
  EST_EARNINGS_LABEL,
  networkCell,
  networkFeeCell,
  singleOrDelta,
  withdrawalCell,
  type ModalGridCell
} from './ModalGridCells';

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
type EarnModalGridRow = ModalGridCell[];

/** The display strings every earn entry grid takes (the module types extend it). */
export type EarnEntryRowInput = {
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /**
   * The flow's supported chains. More than one turns the Network cell into the
   * switch dropdown — entry screens only; the review keeps the static value,
   * since its numbers were built for one chain.
   */
  networkChainIds?: number[];
  /** Position value before the action. */
  supplyBefore: string;
  /** Position value after the action. */
  supplyAfter: string;
  /** 1Y projected earnings on the position before the action. */
  earningsBefore: string;
  /** 1Y projected earnings on the position after the action. */
  earningsAfter: string;
  /** When false the Supply / Est. earnings cells collapse to their `before` value (no delta drawn). */
  hasAmount: boolean;
  /** Network fee, formatted. */
  networkFee: string;
  /** The position read is unresolved — the Supply and Est. earnings cells render skeletons. */
  positionLoading?: boolean;
};

/** The product-specific cells of an entry grid. */
type EarnEntryCells = {
  /** The [Rate | Network] row's rate cell — label, accent and explainer are per product. */
  rate: ModalGridCell;
  /** Symbol for the Supply cell's 12px value icon. */
  supplyToken: string;
  /** Symbol for the Est. earnings cell's value icon; omitted for `$`-formatted projections. */
  earningsToken?: string;
  /** A cell paired left of Network fee (the savings L2 min-out floor, the rewards token); omitted, the fee runs full-width. */
  feeCompanion?: ModalGridCell;
};

/**
 * The entry grid: [Rate | Network], [Supply | Est. earnings (1Y)], then Network
 * fee — full-width, or paired with `feeCompanion`. With no amount entered the
 * delta cells collapse to their current value; entering one draws the
 * before→after arrows.
 */
export function buildEarnEntryRows(
  input: EarnEntryRowInput,
  { rate, supplyToken, earningsToken, feeCompanion }: EarnEntryCells
): EarnModalGridRow[] {
  const loading = input.positionLoading !== undefined ? { loading: input.positionLoading } : {};
  const networkFee = networkFeeCell(input.networkFee);
  return [
    [rate, networkCell(input.network, undefined, input.networkChainIds)],
    [
      singleOrDelta(
        { label: 'Supply', token: supplyToken, ...loading },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        {
          label: EST_EARNINGS_LABEL,
          ...(earningsToken !== undefined && { token: earningsToken }),
          ...loading
        },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    feeCompanion ? [feeCompanion, networkFee] : [networkFee]
  ];
}

/** The display strings every earn review grid takes (the module types extend it). */
export type EarnReviewRowInput = {
  /** Withdrawal availability (e.g. "Anytime", "Liquidity based"). */
  withdrawal: string;
  /** Network the transaction runs on. */
  network: string;
  /** Network fee, formatted. */
  networkFee: string;
};

/** The product-specific cells of a review grid. */
type EarnReviewCells = {
  /** The first row — the amount/receive/earnings cells each product leads with. */
  leading: EarnModalGridRow;
  /** The Product cell (name + ringed token icon). */
  product: ModalGridCell;
  /** The Rate cell. */
  rate: ModalGridCell;
  /** A cell paired left of Network fee (the stUSDS Route); omitted, the fee runs full-width. */
  feeCompanion?: ModalGridCell;
};

/**
 * The review grid: the product's leading row, [Product | Rate],
 * [Withdrawal | Network], then Network fee — full-width, or paired with
 * `feeCompanion`.
 */
export function buildEarnReviewRows(
  input: EarnReviewRowInput,
  { leading, product, rate, feeCompanion }: EarnReviewCells
): EarnModalGridRow[] {
  const networkFee = networkFeeCell(input.networkFee);
  return [
    leading,
    [product, rate],
    [withdrawalCell(input.withdrawal), networkCell(input.network)],
    feeCompanion ? [feeCompanion, networkFee] : [networkFee]
  ];
}
