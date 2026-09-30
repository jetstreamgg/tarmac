/** The UTC calendar day of a unix timestamp as 'YYYY-MM-DD', the BA Labs daily series key. */
export const dayIsoOf = (timestampSec: number): string =>
  new Date(timestampSec * 1000).toISOString().slice(0, 10);

/** Price on the day, else the nearest previous day in the series (ISO strings sort chronologically). */
export function priceAtOrBefore(prices: Map<string, number>, dayIso: string): number | undefined {
  const exact = prices.get(dayIso);
  if (exact !== undefined) return exact;
  let bestDay: string | undefined;
  for (const day of prices.keys()) {
    if (day <= dayIso && (bestDay === undefined || day > bestDay)) bestDay = day;
  }
  return bestDay === undefined ? undefined : prices.get(bestDay);
}
