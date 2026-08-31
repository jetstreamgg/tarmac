import { formatDecimalPercentage } from '@/utils/formatValue';

/**
 * Pendle's API uses positive = favorable; we display with the inverse
 * convention so positive = unfavorable (matching TradeWidget/StUSDSWidget, the
 * redeem sheet and broader DeFi conventions). The raw `quote.priceImpact`
 * stays unflipped for analytics/debugging — only the display negates.
 *
 * Three decimals match the legacy modal and `PendleRedeem`: an AMM impact of
 * 0.004% is real information that a two-decimal cap renders as "0.00%".
 *
 * `priceImpact` is typed non-optional on the quote but passed straight through
 * from the API with no runtime validation (`useQuotePendleConvert.ts`), so a
 * missing or non-finite field returns `undefined` for the caller's own
 * placeholder rather than rendering "NaN%".
 */
export function formatPriceImpact(rawPriceImpact: number | undefined): string | undefined {
  if (rawPriceImpact === undefined || !Number.isFinite(rawPriceImpact)) return undefined;

  const display = -rawPriceImpact;
  // Negating turns 0 into -0, and any magnitude under half the last displayed
  // decimal would print as "-0.000%"; both read as a (tiny) gain that isn't there.
  return formatDecimalPercentage(Math.abs(display) < 0.000005 ? 0 : display, 3);
}
