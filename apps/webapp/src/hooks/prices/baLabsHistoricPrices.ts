import { URL_BA_LABS_API_MAINNET } from '../constants';
import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';

type BaLabsHistoricRow = {
  date: string;
  price: string;
};

/**
 * Full daily USD price history of a token as a 'YYYY-MM-DD' → price map, for
 * valuing past events (Merkl claims) at the price of their day. An empty
 * series THROWS instead of resolving: this is only ever called for attributed
 * reward tokens, which always have a history, so empty means the source
 * failed — and a resolved empty map would be cached by react-query as a 24h
 * success, turning a transient outage into a sticky 'reconciliation-failed'
 * instead of a retried 'source-error'.
 */
export async function fetchBaLabsHistoricDailyPrices({
  tokenAddress
}: {
  tokenAddress: string;
}): Promise<Map<string, number>> {
  const url = formatBaLabsUrl(
    new URL(`${URL_BA_LABS_API_MAINNET}/tokens/${tokenAddress.toLowerCase()}/historic/?p_size=9999`)
  );
  const rows = await fetchBaLabsPages<BaLabsHistoricRow>(url);

  const prices = new Map<string, number>();
  for (const { date, price } of rows) {
    const parsed = Number(price);
    if (Number.isFinite(parsed)) prices.set(date, parsed);
  }
  if (prices.size === 0) {
    throw new Error(`Empty BA Labs price history for ${tokenAddress}`);
  }
  return prices;
}
