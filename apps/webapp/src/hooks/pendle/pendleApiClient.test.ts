import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPendleDashboardPositions,
  fetchPendlePnlGainedPositions,
  fetchPendlePnlTransactionsForUser
} from './pendleApiClient';
import { PENDLE_API_BASE_URL } from './constants';
import { TENDERLY_CHAIN_ID } from '../constants';

const USER = '0x1111111111111111111111111111111111111111' as const;

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('fetchPendlePnlTransactionsForUser', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the expected URL with lowercased user, chainId=1, and limit=1000', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0, results: [] }));

    await fetchPendlePnlTransactionsForUser(USER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl.startsWith(`${PENDLE_API_BASE_URL}/v1/pnl/transactions?`)).toBe(true);
    const params = new URL(calledUrl).searchParams;
    expect(params.get('user')).toBe(USER.toLowerCase());
    expect(params.get('chainId')).toBe('1');
    expect(params.get('limit')).toBe('1000');
    // No per-market scoping — the single unfiltered call is what gives this
    // refactor its 13×N → 1 fanout reduction. Adding `market` here would
    // silently re-introduce the per-market fanout cost.
    expect(params.get('market')).toBeNull();
  });

  it('rewrites the Tenderly chain id to mainnet (Pendle API does not serve forks)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0, results: [] }));

    await fetchPendlePnlTransactionsForUser(USER, { chainId: TENDERLY_CHAIN_ID });

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(new URL(calledUrl).searchParams.get('chainId')).toBe('1');
  });

  it('returns [] when the API omits the results field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0 }));
    const out = await fetchPendlePnlTransactionsForUser(USER);
    expect(out).toEqual([]);
  });

  it('throws with the status code on non-2xx responses (so the hook can degrade)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, { status: 503 }));

    await expect(fetchPendlePnlTransactionsForUser(USER)).rejects.toThrow('503');
  });
});

describe('fetchPendlePnlGainedPositions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the exact path with the lowercased user and NO query params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0, positions: [] }));

    await fetchPendlePnlGainedPositions(USER);

    // The endpoint IGNORES a chainId param (verified live 2026-08-19: 4 chains
    // came back regardless) — sending one would only suggest a filter that
    // doesn't exist. Callers filter client-side.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${PENDLE_API_BASE_URL}/v1/pnl/gained/${USER.toLowerCase()}/positions`
    );
  });

  it('returns the positions array untouched', async () => {
    const positions = [{ market: '0xdead', chainId: 1, pnl: { netGain: { usd: 1 } } }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 1, positions }));

    const out = await fetchPendlePnlGainedPositions(USER);
    expect(out).toEqual(positions);
  });

  it('returns [] when the API omits the positions field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 0 }));
    expect(await fetchPendlePnlGainedPositions(USER)).toEqual([]);
  });

  it('throws with the status code on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, { status: 500 }));
    await expect(fetchPendlePnlGainedPositions(USER)).rejects.toThrow('500');
  });
});

describe('fetchPendleDashboardPositions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the exact path with the lowercased user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ positions: [] }));

    await fetchPendleDashboardPositions(USER);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${PENDLE_API_BASE_URL}/v1/dashboard/positions/database/${USER.toLowerCase()}`
    );
  });

  it('returns the per-chain positions array untouched', async () => {
    const positions = [{ chainId: 1, openPositions: [], closedPositions: [{ marketId: '1-0xdead' }] }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ positions }));

    const out = await fetchPendleDashboardPositions(USER);
    expect(out).toEqual(positions);
  });

  it('returns [] when the API omits the positions field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    expect(await fetchPendleDashboardPositions(USER)).toEqual([]);
  });

  it('throws with the status code on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, { status: 502 }));
    await expect(fetchPendleDashboardPositions(USER)).rejects.toThrow('502');
  });
});
