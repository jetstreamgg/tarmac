/**
 * Pure row builders for the "Review conversion" modal (Figma 486:32223). Rows are
 * *data* (an array), not a fixed JSX block — `ConvertReviewContent` maps them to UI
 * and decorates the `rate`/`network` rows with icons. The label set + order is the
 * Figma contract and is asserted in `convertModalRows.test.ts`.
 */

/** Distinguishes rows the review body decorates with icons from plain text rows. */
export type ConvertModalRowKind = 'rate' | 'network' | 'plain';

export type ConvertModalRow = { kind: ConvertModalRowKind; label: string; value: string };

export type ConvertModalRowInput = {
  /** Origin token symbol (e.g. "USDS"). */
  originSymbol: string;
  /** Target token symbol (e.g. "USDC"). */
  targetSymbol: string;
  /** Network the conversion runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Rows for the "Review conversion" modal (Figma 486:32223): `Rate` (token-iconed),
 * `Network` (chain-iconed), `Slippage`, `Fee`, `Network fee`. Rate/Slippage/Fee are
 * PSM guarantees (1:1, no slippage, no fees) — the engine disables the flow before
 * review whenever mainnet tin/tout is non-zero, so the static values can never lie.
 */
export function buildConvertModalRows(input: ConvertModalRowInput): ConvertModalRow[] {
  return [
    { kind: 'rate', label: 'Rate', value: `1.00 ${input.originSymbol} = 1.00 ${input.targetSymbol}` },
    { kind: 'network', label: 'Network', value: input.network },
    { kind: 'plain', label: 'Slippage', value: '0.00%' },
    { kind: 'plain', label: 'Fee', value: '$0.00' },
    { kind: 'plain', label: 'Network fee', value: input.networkFee }
  ];
}
