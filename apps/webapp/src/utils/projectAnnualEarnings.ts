/**
 * Projected earnings over one year: principal × annual rate, simple
 * (non-compounded). A missing rate — a product still loading or one with no
 * APY — contributes 0 rather than NaN. Single definition of the "1Y projected
 * earnings" figure shown across the app.
 *
 * @param principalUsd amount at work, in USD
 * @param rate annual rate as a decimal fraction (0.045 = 4.5%), or undefined
 */
export function projectAnnualEarnings(principalUsd: number, rate: number | undefined): number {
  return principalUsd * (rate ?? 0);
}
