import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBaLabsHistoricDailyPrices } from './baLabsHistoricPrices';

const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('fetchBaLabsHistoricDailyPrices', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs the token historic endpoint with a full-history row budget', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ count: 1, next: null, results: [{ date: '2026-08-15', price: '1.0' }] })
    );

    await fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      `https://info-sky.blockanalitica.com/api/v1/tokens/${USDS.toLowerCase()}/historic/`
    );
    expect(url.searchParams.get('p_size')).toBe('9999');
    expect(url.searchParams.get('format')).toBe('json');
  });

  it('maps the newest-first rows into a day → price map', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        count: 3,
        next: null,
        results: [
          { date: '2026-08-15', price: '0.999800000000000000' },
          { date: '2026-08-14', price: '0.999800000000000000' },
          { date: '2026-08-13', price: '0.999777082000000000' }
        ]
      })
    );

    const prices = await fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS });

    expect(prices.size).toBe(3);
    expect(prices.get('2026-08-14')).toBe(0.9998);
    expect(prices.get('2026-08-13')).toBe(0.999777082);
  });

  it('skips rows whose price does not parse to a finite number', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        count: 2,
        next: null,
        results: [
          { date: '2026-08-15', price: 'not-a-number' },
          { date: '2026-08-14', price: '1.5' }
        ]
      })
    );

    const prices = await fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS });

    expect([...prices.keys()]).toEqual(['2026-08-14']);
  });

  // An empty series must throw, not resolve: react-query would cache an empty
  // map as a 24h success and every Merkl figure would read as a permanent
  // 'reconciliation-failed' instead of a retried 'source-error' (finding #5).
  it('throws on a non-ok response so react-query retries instead of caching', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));

    await expect(fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS })).rejects.toThrow(/price history/i);
  });

  it('throws when the series comes back empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 0, next: null, results: [] }));

    await expect(fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS })).rejects.toThrow(/price history/i);
  });

  it('throws when no row parses to a finite price', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ count: 1, next: null, results: [{ date: '2026-08-15', price: 'not-a-number' }] })
    );

    await expect(fetchBaLabsHistoricDailyPrices({ tokenAddress: USDS })).rejects.toThrow(/price history/i);
  });
});
