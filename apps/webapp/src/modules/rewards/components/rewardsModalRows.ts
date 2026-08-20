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
import { singleOrDelta } from '@/components/product/ModalGridCells';

/** One labelled grid cell — the shared modal-grid cell model (single or before→after delta). */
export type RewardsModalCell = ModalGridCell;

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type RewardsModalGridRow = RewardsModalCell[];

/** Display strings for the "Supply to {farm}" entry grid. */
export type RewardsSupplyModalRowInput = {
  /** Current reward rate, formatted (e.g. "4.50%"), or "–" for point farms. */
  rate: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Symbol of the staked token for the Supply cell icon (USDS for every current farm). */
  supplyToken: string;
  /** Supplied (staked) position before the deposit. */
  supplyBefore: string;
  /** Supplied (staked) position after the deposit. */
  supplyAfter: string;
  /** When false the Supply / Est. earnings cells collapse to their `before` value (no delta drawn). */
  hasAmount: boolean;
  /** 1Y projected earnings before, `$`-formatted (position × rate), or "–" for point farms. */
  earningsBefore: string;
  /** 1Y projected earnings after, `$`-formatted, or "–" for point farms. */
  earningsAfter: string;
  /** Reward-token symbol for the "Rewards in" cell; omit for point farms (CLE). */
  rewardsIn?: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
  /** The staked-position read is unresolved — the Supply and Est. earnings cells render skeletons. */
  positionLoading?: boolean;
};

/**
 * Grid for the "Supply to {farm}" entry screen — the Savings entry shape with
 * the farm's data points: [Rate | Network], [Supply | Est. earnings (1Y)],
 * then Rewards in paired with Network fee (or Network fee full-width on point
 * farms). With no amount entered the delta cells collapse to their current
 * value; entering one draws the before→after arrows.
 */
export function buildRewardsSupplyModalRows(input: RewardsSupplyModalRowInput): RewardsModalGridRow[] {
  const networkFee: RewardsModalCell = { kind: 'single', label: 'Network fee', value: input.networkFee };
  return [
    [
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: input.supplyToken, loading: input.positionLoading },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: 'Est. 1Y yield (at current rate)', loading: input.positionLoading },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    input.rewardsIn
      ? [{ kind: 'single', label: 'Rewards in', value: input.rewardsIn, token: input.rewardsIn }, networkFee]
      : [networkFee]
  ];
}

/** Display strings for the "Withdraw from {farm}" entry grid. */
export type RewardsWithdrawModalRowInput = Omit<RewardsSupplyModalRowInput, 'rewardsIn'>;

/**
 * Grid for the "Withdraw from {farm}" entry screen — the supply grid's mirror
 * without the Rewards in cell: [Rate | Network], [Supply | Est. earnings (1Y)],
 * Network fee. The rate is unchanged by a withdrawal, so it stays single.
 */
export function buildRewardsWithdrawModalRows(input: RewardsWithdrawModalRowInput): RewardsModalGridRow[] {
  return [
    [
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: input.supplyToken, loading: input.positionLoading },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: 'Est. 1Y yield (at current rate)', loading: input.positionLoading },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}

/** Display strings for the "Review supply" stage. */
export type RewardsSupplyReviewRowInput = {
  /** 1Y projected earnings after the deposit, `$`-formatted, or "–" for point farms. */
  estEarnings: string;
  /** Product name (e.g. "SPK Rewards"). */
  product: string;
  /** Token symbol drawn in the Product cell's ringed iconbox (reward token, else the supply token). */
  productToken: string;
  /** Current reward rate, formatted, or "–". */
  rate: string;
  /** Withdrawal availability (reads "Anytime"). */
  withdrawal: string;
  /** Network the transaction runs on. */
  network: string;
  /** Reward-token symbol for the "Rewards in" cell; omit for point farms. */
  rewardsIn?: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the "Review supply" stage — the Savings review shape with the farm's
 * data points: [Rewards in | Est. earnings (1Y)] (Est. earnings full-width on
 * point farms), [Product | Rate], [Withdrawal | Network], Network fee.
 */
export function buildRewardsSupplyReviewRows(input: RewardsSupplyReviewRowInput): RewardsModalGridRow[] {
  const estEarnings: RewardsModalCell = {
    kind: 'single',
    label: 'Est. 1Y yield (at current rate)',
    value: input.estEarnings,
    trend: true
  };
  return [
    input.rewardsIn
      ? [{ kind: 'single', label: 'Rewards in', value: input.rewardsIn, token: input.rewardsIn }, estEarnings]
      : [estEarnings],
    [
      {
        kind: 'single',
        label: 'Product',
        value: input.product,
        token: input.productToken,
        productIcon: 'default'
      },
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' }
    ],
    [
      { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}

/** Display strings for the "Review withdrawal" stage. */
export type RewardsWithdrawReviewRowInput = {
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
  /** Withdrawal availability (reads "Instant" — `withdraw(amount)` is immediate). */
  withdrawal: string;
  /** Network the transaction runs on. */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the "Review withdrawal" stage — the Savings withdraw-review shape:
 * [You'll receive | Est. earnings (1Y)], [Product | Rate],
 * [Withdrawal | Network], Network fee.
 */
export function buildRewardsWithdrawReviewRows(input: RewardsWithdrawReviewRowInput): RewardsModalGridRow[] {
  return [
    [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: input.receiveToken },
      { kind: 'single', label: 'Est. 1Y yield (at current rate)', value: input.estEarnings, trend: true }
    ],
    [
      {
        kind: 'single',
        label: 'Product',
        value: input.product,
        token: input.productToken,
        productIcon: 'default'
      },
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' }
    ],
    [
      { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}
