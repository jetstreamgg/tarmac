/**
 * Pure cell builders for the Pendle transaction modals (Figma 859:41118 /
 * 859:41388 supply entries, 859:41473 withdraw entry, 859:41264 / 859:41606
 * review supply, 859:41679 review withdrawal). Same grid contract as the
 * savings/vault builders: rows of shared `ModalGridCell`s, asserted in
 * `pendleModalRows.test.ts`. Pendle-specific hints: the Fixed rate cells carry
 * the savings green-percent accent (deltas accent both values), the review
 * Product cell draws the underlying icon inside the pendle-gradient ring, and
 * the Slippage cell carries the mode badge plus the inline gear `action`.
 */

import type { ReactNode } from 'react';
import type { ModalGridCell } from '@/components/product/ModalGridCells';

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type PendleModalGridRow = ModalGridCell[];

const singleOrDelta = (
  base: { label: string } & Partial<ModalGridCell>,
  before: string,
  after: string,
  hasAmount: boolean
): ModalGridCell =>
  hasAmount
    ? ({ ...base, kind: 'delta', before, after } as ModalGridCell)
    : ({ ...base, kind: 'single', value: before } as ModalGridCell);

/** Display strings for the Pendle supply/withdraw entry screens (Figma 859:41118 / 859:41473). */
export type PendleEntryRowInput = {
  /** Market fixed rate, formatted (e.g. "4.20%"). */
  rateBefore: string;
  /** Effective rate at the entered amount (quote), formatted. */
  rateAfter: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Display symbol for the 12px value icons — USDS on pegged markets. */
  displaySymbol: string;
  /** Position present value before/after the action. */
  supplyBefore: string;
  supplyAfter: string;
  /** Earnings-to-maturity on the position before/after the action. */
  earningsBefore: string;
  earningsAfter: string;
  /** Claimable at maturity before/after the action. */
  claimBefore: string;
  claimAfter: string;
  /** Whole days until market expiry — the "(49D)" suffix. */
  daysToMaturity: number;
  /** Market expiry, formatted (e.g. "18 Jun 2026"). */
  claimDate: string;
  /** When false the delta cells collapse to their `before` value (no delta drawn). */
  hasAmount: boolean;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the Pendle entry screens — one shape for both flows (Figma draws
 * supply 859:41388 and withdraw 859:41473 identically, only the delta
 * directions differ): [Fixed rate | Network], [Supply | Est. earnings (ND)],
 * [You'll claim | Claim date], then Network fee full-width.
 */
export function buildPendleEntryRows(input: PendleEntryRowInput): PendleModalGridRow[] {
  const earningsLabel = `Est. earnings (${input.daysToMaturity}D)`;
  return [
    [
      singleOrDelta(
        { label: 'Fixed rate', rateAccent: 'savings' },
        input.rateBefore,
        input.rateAfter,
        input.hasAmount
      ),
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: input.displaySymbol },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: earningsLabel, token: input.displaySymbol },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    [
      singleOrDelta(
        { label: "You'll claim", token: input.displaySymbol },
        input.claimBefore,
        input.claimAfter,
        input.hasAmount
      ),
      { kind: 'single', label: 'Claim date', value: input.claimDate }
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}

/** Display strings for the Pendle review stages (Figma 859:41264 supply / 859:41679 withdrawal). */
export type PendleReviewRowInput = {
  /** Display symbol for the 12px value icons — USDS on pegged markets. */
  displaySymbol: string;
  /** Supply: claimable at maturity after the action. */
  claimAfter: string;
  /** Market expiry, formatted. */
  claimDate: string;
  /** Earnings-to-maturity on the position after the action. */
  earningsAfter: string;
  /** Whole days until market expiry. */
  daysToMaturity: number;
  /** Withdraw: amount received now, formatted. */
  receiveAmount: string;
  /** Withdraw: symbol of the token received. */
  receiveSymbol: string;
  /** Effective rate of the trade, formatted. */
  rate: string;
  /** Product display name (e.g. "Pendle sUSDS (PT-sUSDS)"). */
  product: string;
  /** Underlying symbol for the Product cell's ringed icon. */
  productSymbol: string;
  /** Withdrawal availability — Figma: "Anytime" on supply, "Instant" on withdraw. */
  withdrawal: string;
  /** Current slippage, formatted (e.g. "0.50%"). */
  slippage: string;
  /** Slippage mode badge text — "Auto" at the flow default, "Custom" otherwise. */
  slippageMode: string;
  /** Inline gear opening the slippage menu (interactive, passed through opaquely). */
  slippageAction?: ReactNode;
  /** Network the transaction runs on. */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the Pendle review stages. Supply (Figma 859:41264): [You'll claim |
 * Claim date], [Total earnings | Fixed rate], [Product | Withdrawal],
 * [Slippage | Network], then Network fee full-width. Withdraw follows
 * 859:41679 with the Slippage cell slotted in ([Withdrawal | Slippage],
 * [Network | Network fee]) — the comp omits slippage, but the sell quote uses
 * it the same way the buy does, so the control must stay reachable.
 */
export function buildPendleReviewRows(
  flow: 'supply' | 'withdraw',
  input: PendleReviewRowInput
): PendleModalGridRow[] {
  const slippageCell: ModalGridCell = {
    kind: 'single',
    label: 'Slippage',
    labelBadge: input.slippageMode,
    value: input.slippage,
    action: input.slippageAction
  };
  const productCell: ModalGridCell = {
    kind: 'single',
    label: 'Product',
    value: input.product,
    token: input.productSymbol,
    productIcon: 'pendle'
  };
  const networkCell: ModalGridCell = {
    kind: 'single',
    label: 'Network',
    value: input.network,
    network: true
  };
  const feeCell: ModalGridCell = { kind: 'single', label: 'Network fee', value: input.networkFee };

  if (flow === 'supply') {
    return [
      [
        { kind: 'single', label: "You'll claim", value: input.claimAfter, token: input.displaySymbol },
        { kind: 'single', label: 'Claim date', value: input.claimDate }
      ],
      [
        {
          kind: 'single',
          label: 'Total earnings',
          value: input.earningsAfter,
          trend: true,
          trailingToken: input.displaySymbol
        },
        { kind: 'single', label: 'Fixed rate', value: input.rate, rateAccent: 'savings' }
      ],
      [productCell, { kind: 'single', label: 'Withdrawal', value: input.withdrawal }],
      [slippageCell, networkCell],
      [feeCell]
    ];
  }
  return [
    [
      { kind: 'single', label: "You'll receive", value: input.receiveAmount, token: input.receiveSymbol },
      {
        kind: 'single',
        label: `Est. earnings (${input.daysToMaturity}D)`,
        value: input.earningsAfter,
        trend: true,
        trailingToken: input.displaySymbol
      }
    ],
    [productCell, { kind: 'single', label: 'Fixed rate', value: input.rate, rateAccent: 'savings' }],
    [{ kind: 'single', label: 'Withdrawal', value: input.withdrawal }, slippageCell],
    [networkCell, feeCell]
  ];
}
