/**
 * Sources for the canonical Spark vault rate, already formatted for display.
 *
 * Both are formatted percentage strings (e.g. `"3.65%"`, `"0.00%"`) or
 * `undefined` when their source has nothing to show:
 * - `apiFormattedRate` is the Spark Savings API net APY
 *   (`marketData.rate.formattedNetRate`). It is a *present* `"0.00%"` for a
 *   genuinely-zero (dormant) rate, and `undefined` only when the API has no
 *   rate at all — the normalizer encodes that distinction upstream.
 * - `onChainFormattedRate` is the on-chain Vault Savings Rate (`vsr`) formatted
 *   as an APY — the fallback when the API has no figure.
 */
export type SparkRateSources = {
  apiFormattedRate?: string;
  onChainFormattedRate?: string;
};

/**
 * Resolve the single canonical Spark vault rate: prefer the API `apy` when
 * present, fall back to the on-chain `vsr`.
 *
 * `??` (not `||`) is deliberate: a genuinely-zero rate arrives as the *present*
 * string `"0.00%"` and must win over the on-chain fallback — only an absent
 * (`undefined`) API rate falls through. This keeps every Spark-rate surface
 * (header, stats card, transaction overview) reading from one resolved value,
 * so they can never disagree.
 */
export function resolveSparkVaultRate({
  apiFormattedRate,
  onChainFormattedRate
}: SparkRateSources): string | undefined {
  return apiFormattedRate ?? onChainFormattedRate;
}
