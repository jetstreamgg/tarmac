/**
 * Pure row builders for the Savings transaction modals (PRD module 3). Each
 * screen's row set differs, so rows are *data* (an array), not a fixed JSX block —
 * the modal entry body maps them to UI. The exact label set + which rows are
 * single-value vs before→after is the Figma contract and is asserted in
 * `savingsModalRows.test.ts`.
 */

/** The fee row's label. Shared with the renderer, which hangs the tooltip off it. */
export const NETWORK_FEE_LABEL = 'Network fee';

/** A modal detail row: a single value, or a before→after delta (Figma "x → y"). */
export type SavingsModalRow =
  | { kind: 'single'; label: string; value: string }
  | { kind: 'delta'; label: string; before: string; after: string };

/** Display strings for the "Supply to Sky Savings" modal (Figma 527:7591). */
export type SupplyModalRowInput = {
  /** Current savings rate, formatted (e.g. "6.50%"). */
  savingsRate: string;
  /** Supply (position) value before the deposit. */
  supplyBefore: string;
  /** Supply (position) value after the deposit. */
  supplyAfter: string;
  /**
   * L2 PSM supply only: the slippage floor ("Receive at least" min sUSDS out),
   * formatted (e.g. "4.95 sUSDS"). Omitted on mainnet — Figma draws mainnet only,
   * so this row is added "in the spirit of the design" for the L2 swap.
   */
  minReceived?: string;
  /** 1Y estimated earnings before — stubbed until a projection source exists. */
  earningsBefore: string;
  /** 1Y estimated earnings after — stubbed until a projection source exists. */
  earningsAfter: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Rows for the has-position "Supply to Sky Savings" modal (Figma 527:7591):
 * `Savings rate` (single), `Supply` (before→after), `1Y est. earnings`
 * (before→after), `Network` (single), `Network fee` (single). Projection deltas
 * are stubbed by the caller per the PRD's Out of Scope (no cost-basis source yet).
 *
 * On L2, when `minReceived` is supplied, a `Receive at least` single row is inserted
 * right after `Supply` to surface the PSM slippage floor — the one L2-only addition
 * to the Figma set ("Figma is the minimum UX, not the cap").
 */
export function buildSupplyModalRows(input: SupplyModalRowInput): SavingsModalRow[] {
  return [
    { kind: 'single', label: 'Savings rate', value: input.savingsRate },
    { kind: 'delta', label: 'Supply', before: input.supplyBefore, after: input.supplyAfter },
    ...(input.minReceived
      ? [{ kind: 'single' as const, label: 'Receive at least', value: input.minReceived }]
      : []),
    { kind: 'delta', label: '1Y est. earnings', before: input.earningsBefore, after: input.earningsAfter },
    { kind: 'single', label: 'Network', value: input.network },
    { kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }
  ];
}

/** Display strings for the "Withdraw from Sky Savings" modal (Figma 527:10945). */
export type WithdrawModalRowInput = {
  /** Savings rate before the withdrawal (the rate the user holds today). */
  savingsRateBefore: string;
  /** Savings rate after the withdrawal. Unchanged in practice, but Figma draws a delta. */
  savingsRateAfter: string;
  /** Supply (position) value before the withdrawal. */
  supplyBefore: string;
  /** Supply (position) value after the withdrawal. */
  supplyAfter: string;
  /** 1Y estimated earnings before — stubbed until a projection source exists. */
  earningsBefore: string;
  /** 1Y estimated earnings after — stubbed until a projection source exists. */
  earningsAfter: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Rows for the has-position "Withdraw from Sky Savings" modal (Figma 527:10945):
 * `Savings rate` (before→after), `Supply` (before→after), `1Y est. earnings`
 * (before→after), `Network` (single), `Network fee` (single). Unlike the supply
 * modal, `Savings rate` is a before→after delta here per Figma. Projection deltas
 * are stubbed by the caller per the PRD's Out of Scope (no cost-basis source yet).
 */
export function buildWithdrawModalRows(input: WithdrawModalRowInput): SavingsModalRow[] {
  return [
    { kind: 'delta', label: 'Savings rate', before: input.savingsRateBefore, after: input.savingsRateAfter },
    { kind: 'delta', label: 'Supply', before: input.supplyBefore, after: input.supplyAfter },
    { kind: 'delta', label: '1Y est. earnings', before: input.earningsBefore, after: input.earningsAfter },
    { kind: 'single', label: 'Network', value: input.network },
    { kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }
  ];
}

/** Display strings for the read-only "Review supply" modal (Figma 527:7812). */
export type SupplyReviewRowInput = {
  /** sUSDS you'll receive, formatted (e.g. "9,999.99 sUSDS"). */
  youReceive: string;
  /** Current APY, formatted (e.g. "3.75%"). */
  apy: string;
  /** 1Y estimated earnings — stubbed until a projection source exists. */
  estEarnings: string;
  /** Product name (e.g. "Sky Savings"). */
  product: string;
  /** Withdrawal availability (e.g. "Anytime"). */
  withdrawal: string;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Rows for the no-position "Review supply" modal (Figma 527:7812) — the read-only
 * summary shown after the inline Supply CTA. The supplied amount is rendered as the
 * header by the review component; these are the rows beneath it: `You'll receive`,
 * `APY`, `Est. earnings (1Y)`, `Product`, `Withdrawal`, `Network`, `Network fee`
 * (all single-value). Est. earnings and Network fee are stubbed by the caller per
 * the PRD's Out of Scope (no projection / gas-estimate source yet).
 */
export function buildSupplyReviewRows(input: SupplyReviewRowInput): SavingsModalRow[] {
  return [
    { kind: 'single', label: "You'll receive", value: input.youReceive },
    { kind: 'single', label: 'APY', value: input.apy },
    { kind: 'single', label: 'Est. earnings (1Y)', value: input.estEarnings },
    { kind: 'single', label: 'Product', value: input.product },
    { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
    { kind: 'single', label: 'Network', value: input.network },
    { kind: 'single', label: NETWORK_FEE_LABEL, value: input.networkFee }
  ];
}
