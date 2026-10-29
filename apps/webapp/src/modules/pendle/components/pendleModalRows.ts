/**
 * Pure cell builders for the Pendle transaction modals, per the reworked
 * comps (Figma 2193:73513/73598 entries, 2193:73734/73807 reviews) — the
 * same grid contract as the savings/vault builders.
 *
 * Deliberate divergences from the comps: Price impact stays (PR #1773), the
 * supply Withdrawal cell keeps the risk-sheet wording over "Anytime"
 * (APP-447), and "Min. received" appears on both reviews — the floor the
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
  /** Info popover beside the Claim-at-maturity label (the entry passes one; the review omits it). */
  claimInfo?: ReactNode;
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
    { kind: 'single', label: 'Fixed rate', value: input.rate, rateAccent: 'savings', rateInfo: 'fixedYield' },
    { kind: 'single', label: 'Claim date', value: input.claimDate }
  ],
  [
    {
      kind: 'single',
      label: 'Claim at maturity',
      value: input.claimAtMaturity,
      token: input.displaySymbol,
      labelAction: input.claimInfo
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
  /** Info popover beside the Claim-at-maturity label. */
  claimInfo?: ReactNode;
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
  /** Info popover beside the You'll-receive label. */
  receiveInfo?: ReactNode;
  /** Yield forfeited vs holding to maturity (maturity value − receive now, clamped at 0), formatted. */
  lost: string;
  /** Draw the red down-trend — only when something is actually forfeited. */
  lostTrend: boolean;
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
 * then Network fee full-width. No rate rows — the cost of selling early is
 * stated directly.
 */
export function buildPendleWithdrawEntryRows(input: PendleWithdrawEntryRowInput): PendleModalGridRow[] {
  return [
    [
      { kind: 'node', label: 'Withdrawal token', node: input.tokenSelector },
      {
        kind: 'single',
        label: "You'll receive",
        value: input.receiveAmount,
        token: input.receiveSymbol,
        labelAction: input.receiveInfo
      }
    ],
    [
      {
        kind: 'single',
        label: 'Lost on early withdrawal',
        value: input.lost,
        trend: input.lostTrend ? 'down' : undefined,
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
  /** The Withdrawal-token selector (interactive, passed through opaquely). */
  tokenSelector: ReactNode;
  /** Quoted amount received in the selected token, formatted. */
  receiveAmount: string;
  /**
   * True when the quote routes through an aggregator (non-SY-accepted output).
   * Gates the slippage and price-impact/route rows: only an aggregator hop can slip.
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
  /** Pendle's fee, formatted; only set when the quote reports one above zero. */
  pendleFee?: string;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the matured-claim modal, laid out like the early withdrawal entry
 * (2193:73598): [Withdrawal token | You'll receive], then — aggregator routes
 * only — [Slippage | Min. received] and [Price impact | Routed via], closing
 * with [Network | Network fee]. A Pendle fee row joins only when the quote
 * reports a fee, so a fee-free claim keeps the layout without hiding a cost.
 *
 * A direct redemption can't slip: PT converts to SY at the rate fixed at
 * expiry, and the SY's redemption value only grows. It still signs a
 * slippage-adjusted minTokenOut (see buildVerifiedArgs' matured-exit
 * fixtures), but showing that floor would suggest a cost that never happens.
 */
export function buildPendleRedeemRows(input: PendleRedeemRowInput): PendleModalGridRow[] {
  return [
    [
      { kind: 'node', label: 'Withdrawal token', node: input.tokenSelector },
      {
        kind: 'single',
        label: "You'll receive",
        value: input.receiveAmount,
        token: input.receiveSymbol,
        loading: input.quoteLoading
      }
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
    ...(input.pendleFee
      ? [
          [
            { kind: 'single' as const, label: 'Pendle fee', value: input.pendleFee },
            networkCell(input.network, input.networkChainId)
          ],
          [networkFeeCell(input.networkFee)]
        ]
      : [[networkCell(input.network, input.networkChainId), networkFeeCell(input.networkFee)]])
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
 * Grid for the Pendle review stages: supply per Figma 2193:73734 (plus the
 * [Slippage | Price impact] and [Min. received | Network] rows the comp
 * omits), withdraw per 2193:73807 (its disclosure renders as the modal
 * subtitle, not a grid row).
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
