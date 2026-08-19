import { URL_BA_LABS_API_MAINNET } from '../constants';
import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';

type BaLabsHistoricRow = {
  date: string;
  price: string;
};

/**
 * Full daily USD price history of a token as a 'YYYY-MM-DD' → price map, for
 * valuing past events (Merkl claims) at the price of their day. Failures
 * surface as an empty map — callers degrade to notAvailable, never guess.
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
  return prices;
}
