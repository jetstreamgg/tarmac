/**
 * Pure cell builders for the stUSDS transaction modals. No dedicated comps
 * exist — the grids follow the vault-family template (`vaultModalRows.ts`,
 * Figma 859:38105/38297 entries, 859:38553/38234 reviews) per the restyle
 * spec, with two stUSDS-specific divergences: the supply review swaps
 * Est. earnings for the receive quote (the Curve route makes it material
 * information), and both reviews carry a Route cell whose badge names the
 * liquidity route (Native / Curve — the Pendle slippage Auto/Custom badge
 * precedent). The Rate cells stay plain (no accent): stUSDS has no incentive
 * feed, and the savings green gradient is Savings-specific.
 */

import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { estEarningsTrendCell, productCell, rateCell } from '@/components/product/ModalGridCells';
import {
  buildEarnEntryRows,
  buildEarnReviewRows,
  type EarnEntryRowInput,
  type EarnReviewRowInput
} from '@/components/product/earnModalRows';

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type StUsdsModalGridRow = ModalGridCell[];

const stUsdsRateCell = (rate: string) => rateCell('Rate', rate, undefined, 'stusds');

/** Display strings for the stUSDS supply/withdraw entry screens. */
export type StUsdsEntryRowInput = EarnEntryRowInput & {
  /** Current module rate, formatted (e.g. "6.50%"). */
  rate: string;
};

/**
 * Grid for the stUSDS entry screens — one shape for both flows, mirroring the
 * vault entries: [Rate | Network], [Supply | Est. earnings (1Y)] as
 * before→after deltas, then Network fee full-width.
 */
export function buildStUsdsEntryRows(input: StUsdsEntryRowInput): StUsdsModalGridRow[] {
  return buildEarnEntryRows(input, {
    rate: stUsdsRateCell(input.rate),
    supplyToken: 'USDS',
    earningsToken: 'USDS'
  });
}

/** Display strings for the stUSDS review stages. */
export type StUsdsReviewRowInput = EarnReviewRowInput & {
  /** Entered USDS amount, formatted (the 12px USDS icon carries the denomination). */
  amount: string;
  /** Receive quote, formatted — supply: quoted stUSDS out; withdraw: the entered USDS back. */
  receive: string;
  /** Withdraw only: 1Y projected earnings on the position after the action. */
  estEarnings: string;
  /** Current module rate, formatted. */
  rate: string;
  /** Route badge text — "Native" / "Curve", per the provider selection. */
  route: string;
  /** What executes the route, shown as the cell value (e.g. "stUSDS module" / "Curve pool"). */
  routeDetail: string;
  /** Withdrawal availability — "Liquidity based" per the risk sheet (RiskTierDetails); diverges from the vault-family comp's "Anytime"/"Instant". */
  withdrawal: string;
};

/**
 * Grid for the stUSDS review stages, on the vault review template. Supply:
 * [You'll supply ◉USDS | You'll receive ◉stUSDS] (receive replaces the vault's
 * Est. earnings — the Curve route's price impact makes the quote material, and
 * earnings already showed on entry), [Product | Rate], [Withdrawal | Network],
 * [Route | Network fee]. Withdraw keeps the vault shape: [You'll receive ◉USDS
 * | Est. earnings (1Y)], then the same tail. Product draws the stUSDS icon in
 * the neutral default ring (`productVisuals` — no product gradient for stUSDS).
 */
export function buildStUsdsReviewRows(
  flow: 'supply' | 'withdraw',
  input: StUsdsReviewRowInput
): StUsdsModalGridRow[] {
  const leading: StUsdsModalGridRow =
    flow === 'supply'
      ? [
          { kind: 'single', label: "You'll supply", value: input.amount, token: 'USDS' },
          { kind: 'single', label: "You'll receive", value: input.receive, token: 'stUSDS' }
        ]
      : [
          { kind: 'single', label: "You'll receive", value: input.receive, token: 'USDS' },
          estEarningsTrendCell(input.estEarnings, 'USDS')
        ];
  return buildEarnReviewRows(input, {
    leading,
    product: productCell('stUSDS', 'stUSDS', 'default'),
    rate: stUsdsRateCell(input.rate),
    feeCompanion: { kind: 'single', label: 'Route', labelBadge: input.route, value: input.routeDetail }
  });
}
