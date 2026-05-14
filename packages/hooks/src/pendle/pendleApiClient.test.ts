import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPendlePnlTransactions } from './pendleApiClient';
import { PENDLE_API_BASE_URL } from './constants';
import { TENDERLY_CHAIN_ID } from '../constants';

const MARKET = '0xc5B32DbA5F29f8395fB9591e1A15f23A75214f33' as const;
const USER = '0x1111111111111111111111111111111111111111' as const;

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('fetchPendlePnlTransactions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the expected URL with lowercased addresses and the chainId/limit params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0, results: [] }));

    await fetchPendlePnlTransactions(1, MARKET, USER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl.startsWith(`${PENDLE_API_BASE_URL}/v1/pnl/transactions?`)).toBe(true);
    const params = new URL(calledUrl).searchParams;
    expect(params.get('user')).toBe(USER.toLowerCase());
    expect(params.get('market')).toBe(MARKET.toLowerCase());
    expect(params.get('chainId')).toBe('1');
    expect(params.get('limit')).toBe('100');
  });

  it('rewrites the Tenderly chain id to mainnet (Pendle API does not serve forks)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0, results: [] }));

    await fetchPendlePnlTransactions(TENDERLY_CHAIN_ID, MARKET, USER);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(new URL(calledUrl).searchParams.get('chainId')).toBe('1');
  });

  it('returns the results array as-is when the response is well-formed', async () => {
    const results = [
      {
        timestamp: '2026-05-10T00:00:00Z',
        action: 'redeemPy',
        market: `1-${MARKET.toLowerCase()}`,
        txHash: '0xdead',
        ptData: { unit: 123.4 }
      }
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 1, results }));

    const out = await fetchPendlePnlTransactions(1, MARKET, USER);
    expect(out).toEqual(results);
  });

  it('returns [] when the API omits the results field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0 }));
    const out = await fetchPendlePnlTransactions(1, MARKET, USER);
    expect(out).toEqual([]);
  });

  it('throws with the status code on non-2xx responses (so the hook can degrade)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, { status: 503 }));

    await expect(fetchPendlePnlTransactions(1, MARKET, USER)).rejects.toThrow('503');
  });
});
