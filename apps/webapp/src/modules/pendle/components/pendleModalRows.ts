/**
 * Pure cell builders for the Pendle transaction modals, per the reworked comps
 * (Figma 2193:73513 supply entry, 2193:73598 "Early withdrawal" entry,
 * 2193:73734 review supply, 2193:73807 review withdrawal). Same grid contract
 * as the savings/vault builders: rows of shared `ModalGridCell`s, asserted in
 * `pendleModalRows.test.ts`.
 *
 * Deliberate divergences from the comps: Price impact stays (material AMM
 * risk info, PR #1773), the supply Withdrawal cell keeps the risk-sheet
 * wording over the comp's "Anytime" (single-sourced per APP-447), and
 * "Min. received" appears on both reviews — the slippage floor the
 * disclosure's "may be lower than shown" refers to.
 */

import type { ReactNode } from 'react';
import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { networkCell, networkFeeCell, productCell } from '@/components/product/ModalGridCells';

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type PendleModalGridRow = ModalGridCell[];

// --- Shared cell shapes — every builder draws these identically. ---

const minReceivedCell = (value: string, token: string): ModalGridCell => ({
  kind: 'single',
  label: 'Min. received',
  value,
  token
});

type SlippageInput = { slippage: string; slippageMode: string; slippageAction?: ReactNode };
const slippageCell = ({ slippage, slippageMode, slippageAction }: SlippageInput): ModalGridCell => ({
  kind: 'single',
  label: 'Slippage',
  labelBadge: slippageMode,
  value: slippage,
  action: slippageAction
});

type SupplyEconomicsInput = {
  rate: string;
  claimDate: string;
  displaySymbol: string;
  claimAtMaturity: string;
  estEarnings: string;
  daysToMaturity: number;
};

/**
 * The supply screens' shared economics rows — the comps draw the entry
 * (2193:73513) and review (2193:73734) grids opening identically:
 * [Fixed rate | Claim date], [Claim at maturity | Est. ND yield].
 */
const supplyEconomicsRows = (input: SupplyEconomicsInput): PendleModalGridRow[] => [
  [
    { kind: 'single', label: 'Fixed rate', value: input.rate, rateAccent: 'savings' },
    { kind: 'single', label: 'Claim date', value: input.claimDate }
  ],
  [
    {
      kind: 'single',
      label: 'Claim at maturity',
      value: input.claimAtMaturity,
      token: input.displaySymbol
    },
    {
      kind: 'single',
      label: `Est. ${input.daysToMaturity}D yield`,
      value: input.estEarnings,
      token: input.displaySymbol
    }
  ]
];

/** Display strings for the Pendle supply entry screen (Figma 2193:73513). */
export type PendleSupplyEntryRowInput = {
  /** Rate this order locks — the quote's effective APY, the market implied rate before an amount. */
  rate: string;
  /** Market expiry, formatted (e.g. "18 Jun 2026"). */
  claimDate: string;
  /** Display symbol for the 12px value icons — USDS on pegged markets. */
  displaySymbol: string;
  /** This order's value at maturity (the quoted PT amount), formatted. */
  claimAtMaturity: string;
  /** This order's earnings to maturity (maturity value − cost), formatted. */
  estEarnings: string;
  /** Whole days until market expiry — the "(49D)" suffix. */
  daysToMaturity: number;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon (mainnet/tenderly, not necessarily the connected chain). */
  networkChainId?: number;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the supply entry screen (Figma 2193:73513): [Fixed rate | Claim
 * date], [Claim at maturity | Est. ND yield], [Network | Network fee].
 */
export function buildPendleSupplyEntryRows(input: PendleSupplyEntryRowInput): PendleModalGridRow[] {
  return [
    ...supplyEconomicsRows(input),
    [networkCell(input.network, input.networkChainId), networkFeeCell(input.networkFee)]
  ];
}

/** Display strings for the "Early withdrawal" entry screen (Figma 2193:73598). */
export type PendleWithdrawEntryRowInput = {
  /** The Withdrawal-token selector (interactive, passed through opaquely). */
  tokenSelector: ReactNode;
  /** Amount received now in the selected token, formatted. */
  receiveAmount: string;
  /** Symbol of the token received. */
  receiveSymbol: string;
  /** Yield forfeited vs holding to maturity (maturity value − receive now), formatted. */
  lost: string;
  /** Display symbol for the maturity-value icons — USDS on pegged markets. */
  displaySymbol: string;
  /** Info popover beside the Lost label (the early-withdrawal-impact tooltip). */
  lostInfo?: ReactNode;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the "Early withdrawal" entry screen (Figma 2193:73598):
 * [Withdrawal token | You'll receive], [Lost on early withdrawal | Network],
 * then Network fee full-width. The output-token choice lives here (the amount
 * field's pill is the fixed PT input), and the rate rows are gone — the cost
 * of selling early is stated directly, in tokens, under the red down-trend.
 */
export function buildPendleWithdrawEntryRows(input: PendleWithdrawEntryRowInput): PendleModalGridRow[] {
  return [
    [
      { kind: 'node', label: 'Withdrawal token', node: input.tokenSelector },
      { kind: 'single', label: "You'll receive", value: input.receiveAmount, token: input.receiveSymbol }
    ],
    [
      {
        kind: 'single',
        label: 'Lost on early withdrawal',
        value: input.lost,
        trend: 'down',
        trailingToken: input.displaySymbol,
        labelAction: input.lostInfo
      },
      networkCell(input.network, input.networkChainId)
    ],
    [networkFeeCell(input.networkFee)]
  ];
}

/**
 * Display strings for the matured-claim modal. No comp exists for this flow —
 * the shape follows the withdraw grids (Figma 2193:73598 / 2193:73807) and the
 * matured-position cards' "Claim" CTA (2306:72334).
 */
export type PendleRedeemRowInput = {
  /** Product display name (e.g. "Pendle sUSDS (PT-sUSDS)"). */
  product: string;
  /** Underlying symbol for the Product cell's ringed icon. */
  productSymbol: string;
  /** The full matured PT amount being claimed, formatted. */
  claimAmount: string;
  /** The market's PT symbol (e.g. "PT-sUSDS") — the Claim amount icon. */
  ptSymbol: string;
  /**
   * True when the quote routes through an aggregator (a non-SY-accepted output
   * token) — the only case slippage/price-impact math applies; a pure PT burn
   * at the expiry-frozen rate has none.
   */
  aggregator: boolean;
  /** Quote still in flight — the quote-derived cells hold skeletons instead of dashes. */
  quoteLoading: boolean;
  /** Current slippage, formatted. */
  slippage: string;
  /** Slippage mode badge text. */
  slippageMode: string;
  /** Inline gear opening the slippage menu. */
  slippageAction?: ReactNode;
  /** Slippage floor in the output token, formatted. */
  minReceived: string;
  /** Symbol of the token received. */
  receiveSymbol: string;
  /** Quote price impact, formatted (positive = a cost to the user). */
  priceImpact: string;
  /** Aggregator route description (e.g. "Pendle redeem → KyberSwap"). */
  routedVia: string;
  /** Pendle's fee, formatted (e.g. "$0.04"). */
  pendleFee: string;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the matured-claim modal: [Product | Claim amount], then — only on
 * aggregator routes, where swap math exists — [Slippage | Min. received] and
 * [Price impact | Routed via], closing with [Pendle fee | Network] and the
 * full-width fee row. The payout token is picked on the hero pill, not here:
 * a read-only grid is the wrong home for the flow's one control. A pure
 * redemption drops the swap rows entirely: the
 * slippage control is deliberately absent there (redeeming to an SY-accepted
 * token is fixed-rate; a gear would imply a tolerance that cannot bind), and
 * so is the per-leg price-impact breakdown the legacy overview drew — the
 * aggregate number plus the route line carry the risk info.
 */
export function buildPendleRedeemRows(input: PendleRedeemRowInput): PendleModalGridRow[] {
  const feeCell = networkFeeCell(input.networkFee);
  const pendleFeeCell: ModalGridCell = {
    kind: 'single',
    label: 'Pendle fee',
    value: input.pendleFee,
    loading: input.quoteLoading
  };
  return [
    [
      productCell(input.product, input.productSymbol, 'pendle'),
      { kind: 'single', label: 'Claim amount', value: input.claimAmount, token: input.ptSymbol }
    ],
    ...(input.aggregator
      ? [
          [
            slippageCell(input),
            { ...minReceivedCell(input.minReceived, input.receiveSymbol), loading: input.quoteLoading }
          ],
          [
            {
              kind: 'single' as const,
              label: 'Price impact',
              value: input.priceImpact,
              loading: input.quoteLoading
            },
            {
              kind: 'single' as const,
              label: 'Routed via',
              value: input.routedVia,
              loading: input.quoteLoading
            }
          ]
        ]
      : []),
    [pendleFeeCell, networkCell(input.network, input.networkChainId)],
    [feeCell]
  ];
}

/** Display strings for the Pendle review stages (Figma 2193:73734 supply / 2193:73807 withdrawal). */
export type PendleReviewRowInput = {
  /** Display symbol for the 12px value icons — USDS on pegged markets. */
  displaySymbol: string;
  /** Supply: this order's value at maturity (the quoted PT amount), formatted. */
  claimAtMaturity: string;
  /** Market expiry, formatted. */
  claimDate: string;
  /** Supply: this order's earnings to maturity, formatted. */
  estEarnings: string;
  /** Whole days until market expiry. */
  daysToMaturity: number;
  /** Supply: rate this order locks, formatted. */
  rate: string;
  /** Withdraw: the PT amount being sold, formatted. */
  withdrawalAmount: string;
  /** The market's PT symbol (e.g. "PT-sUSDS") — the Withdrawal amount / supply Min. received icon. */
  ptSymbol: string;
  /** Withdraw: symbol of the token received — the Min. received icon. */
  receiveSymbol: string;
  /** Slippage floor: the minimum the quote guarantees, formatted (PT on supply, output token on withdraw). */
  minReceived: string;
  /** Product display name (e.g. "Pendle sUSDS (PT-sUSDS)"). */
  product: string;
  /** Underlying symbol for the Product cell's ringed icon. */
  productSymbol: string;
  /** Supply: withdrawal availability per the risk sheet ("At maturity or via market sell"). */
  withdrawal: string;
  /** Current slippage, formatted (e.g. "0.50%"). */
  slippage: string;
  /** Slippage mode badge text — "Auto" at the flow default, "Custom" otherwise. */
  slippageMode: string;
  /** Inline gear opening the slippage menu (interactive, passed through opaquely). */
  slippageAction?: ReactNode;
  /**
   * Quote price impact, formatted under the app-wide inverse convention where
   * positive = a cost to the user (e.g. "0.020%") — AMM trade risk info.
   */
  priceImpact: string;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the Pendle review stages. Supply (Figma 2193:73734): [Fixed rate |
 * Claim date], [Claim at maturity | Est. ND yield], [Product |
 * Withdrawal], then the two rows the comp omits but this app keeps — [Slippage
 * | Price impact], [Min. received | Network] — and Network fee. Withdraw
 * (Figma 2193:73807): [Product | Withdrawal amount], [Slippage | Min.
 * received], [Price impact | Network], Network fee; the disclosure paragraph
 * renders as the modal subtitle, not a grid row.
 */
export function buildPendleReviewRows(
  flow: 'supply' | 'withdraw',
  input: PendleReviewRowInput
): PendleModalGridRow[] {
  const priceImpactCell: ModalGridCell = {
    kind: 'single',
    label: 'Price impact',
    value: input.priceImpact
  };
  const product = productCell(input.product, input.productSymbol, 'pendle');
  const network = networkCell(input.network, input.networkChainId);
  const feeCell = networkFeeCell(input.networkFee);

  if (flow === 'supply') {
    return [
      ...supplyEconomicsRows(input),
      [product, { kind: 'single', label: 'Withdrawal', value: input.withdrawal }],
      [slippageCell(input), priceImpactCell],
      [minReceivedCell(input.minReceived, input.ptSymbol), network],
      [feeCell]
    ];
  }
  return [
    [
      product,
      { kind: 'single', label: 'Withdrawal amount', value: input.withdrawalAmount, token: input.ptSymbol }
    ],
    [slippageCell(input), minReceivedCell(input.minReceived, input.receiveSymbol)],
    [priceImpactCell, network],
    [feeCell]
  ];
}
