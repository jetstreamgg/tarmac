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
import { NETWORK_FEE_LABEL, singleOrDelta } from '@/components/product/ModalGridCells';

/** One labelled grid cell — the shared modal-grid cell model (single or before→after delta). */
export type SavingsModalCell = ModalGridCell;

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type SavingsModalGridRow = SavingsModalCell[];

/** Display strings for the "Supply to Sky Savings" entry screen (Figma 859:36036). */
export type SupplyModalRowInput = {
  /** Current savings rate, formatted (e.g. "6.50%"). */
  savingsRate: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Supply (position) value before the deposit. */
  supplyBefore: string;
  /** Supply (position) value after the deposit. */
  supplyAfter: string;
  /** When false the Supply / Est. earnings cells collapse to their `before` value (no delta drawn). */
  hasAmount: boolean;
  /**
   * L2 PSM supply only: the slippage floor ("Receive at least" min sUSDS out),
   * formatted (e.g. "4.95 sUSDS"). Omitted on mainnet — Figma draws mainnet only,
   * so this cell is added "in the spirit of the design" for the L2 swap.
   */
  minReceived?: string;
  /** 1Y projected earnings on the current position, formatted. */
  earningsBefore: string;
  /** 1Y projected earnings on the position the supply leaves behind, formatted. */
  earningsAfter: string;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the "Supply to Sky Savings" entry screen (Figma 859:36036 empty /
 * 859:36088 filled): [Savings rate | Network], [Supply | Est. earnings (1Y)],
 * then Network fee full-width. With no amount entered the delta cells collapse
 * to their current value (859:36036); entering one draws the before→after
 * arrows (859:36088). On L2, `minReceived` pairs into the last row to surface
 * the PSM slippage floor.
 */
export function buildSupplyModalRows(input: SupplyModalRowInput): SavingsModalGridRow[] {
  const networkFee: SavingsModalCell = { kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee };
  return [
    [
      { kind: 'single', label: 'Savings rate', value: input.savingsRate, rateAccent: 'savings' },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: 'USDS' },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: 'Est. earnings (1Y)', token: 'USDS' },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    input.minReceived
      ? [{ kind: 'single', label: 'Receive at least', value: input.minReceived, token: 'sUSDS' }, networkFee]
      : [networkFee]
  ];
}

/** Display strings for the "Withdraw from Sky Savings" entry screen. */
export type WithdrawModalRowInput = {
  /** Current savings rate, formatted. */
  savingsRate: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Supply (position) value before the withdrawal. */
  supplyBefore: string;
  /** Supply (position) value after the withdrawal. */
  supplyAfter: string;
  /** When false the Supply / Est. earnings cells collapse to their `before` value. */
  hasAmount: boolean;
  /** 1Y projected earnings on the current position, formatted. */
  earningsBefore: string;
  /** 1Y projected earnings on the position the withdrawal leaves behind, formatted. */
  earningsAfter: string;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the "Withdraw from Sky Savings" entry screen — the supply grid's
 * mirror: [Savings rate | Network], [Supply | Est. earnings (1Y)], Network fee.
 * The rate is unchanged by a withdrawal, so it stays a single value here (the
 * old flat design drew it as a no-op delta).
 */
export function buildWithdrawModalRows(input: WithdrawModalRowInput): SavingsModalGridRow[] {
  return [
    [
      { kind: 'single', label: 'Savings rate', value: input.savingsRate, rateAccent: 'savings' },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: 'USDS' },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: 'Est. earnings (1Y)', token: 'USDS' },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    [{ kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }]
  ];
}

/** Display strings for the "Review supply" stage (Figma 859:36154). */
export type SupplyReviewRowInput = {
  /** sUSDS you'll receive, formatted (e.g. "9,999.99 sUSDS"). */
  youReceive: string;
  /** 1Y projected earnings on the position the supply leaves behind, formatted. */
  estEarnings: string;
  /** Product name (e.g. "Sky Savings"). */
  product: string;
  /** Current savings rate, formatted (e.g. "3.75%"). */
  rate: string;
  /** Withdrawal availability (e.g. "Anytime"). */
  withdrawal: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the "Review supply" stage (Figma 859:36154): [You'll receive |
 * Est. earnings (1Y)], [Product | Rate], [Withdrawal | Network], then Network
 * fee full-width.
 */
export function buildSupplyReviewRows(input: SupplyReviewRowInput): SavingsModalGridRow[] {
  return [
    [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: 'sUSDS' },
      {
        kind: 'single',
        label: 'Est. earnings (1Y)',
        value: input.estEarnings,
        trend: true,
        // The projection is USDS-denominated whatever you supplied — name it, as
        // the vault and stUSDS reviews do.
        trailingToken: 'USDS'
      }
    ],
    [
      { kind: 'single', label: 'Product', value: input.product, token: 'sUSDS', productIcon: 'default' },
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' }
    ],
    [
      { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [{ kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }]
  ];
}

/** Display strings for the "Review withdrawal" stage (Figma 859:36322). */
export type WithdrawReviewRowInput = {
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
  /** Withdrawal availability (the comp reads "Instant"). */
  withdrawal: string;
  /** Network the transaction runs on. */
  network: string;
  /** Network fee, formatted. */
  networkFee: string;
};

/**
 * Grid for the "Review withdrawal" stage (Figma 859:36322) — the supply
 * review's shape: [You'll receive | Est. earnings (1Y)], [Product | Rate],
 * [Withdrawal | Network], then Network fee full-width.
 */
export function buildWithdrawReviewRows(input: WithdrawReviewRowInput): SavingsModalGridRow[] {
  return [
    [
      { kind: 'single', label: "You'll receive", value: input.youReceive, token: input.receiveToken },
      {
        kind: 'single',
        label: 'Est. earnings (1Y)',
        value: input.estEarnings,
        trend: true,
        trailingToken: 'USDS'
      }
    ],
    [
      { kind: 'single', label: 'Product', value: input.product, token: 'sUSDS', productIcon: 'default' },
      { kind: 'single', label: 'Rate', value: input.rate, rateAccent: 'savings' }
    ],
    [
      { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [{ kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }]
  ];
}
