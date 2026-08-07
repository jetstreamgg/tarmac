import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBaLabsPages } from './fetchBaLabsPages';

const BASE = 'https://info-sky.blockanalitica.com/api/v1/overall/historic/';

/** Server-side page cap: the API never returns more than this, whatever p_size asks. */
const SERVER_PAGE_CAP = 1000;

/**
 * Stand-in for the BA Labs list endpoint: `total` rows, served `SERVER_PAGE_CAP`
 * at a time, with the `next` link the real API emits — including its `http://`
 * scheme, which is why the walker must build its own URLs.
 */
function stubApi(total: number) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    calls.push(url.href);
    const size = Math.min(Number(url.searchParams.get('p_size')) || 100, SERVER_PAGE_CAP);
    const page = Number(url.searchParams.get('p')) || 1;
    const start = (page - 1) * size;
    const results = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => ({
      id: start + i
    }));
    const next =
      start + results.length < total
        ? `http://info-sky.blockanalitica.com/api/v1/overall/historic/?format=json&p=${page + 1}&p_size=${url.searchParams.get('p_size')}`
        : null;
    return { ok: true, json: async () => ({ count: total, next, results }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

const urlFor = (pSize: number) => new URL(`${BASE}?p_size=${pSize}&format=json`);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchBaLabsPages', () => {
  // APP-456 #5: the All-time chart asked for 9999 rows, got the 1000 most recent,
  // and silently started in Nov 2023 instead of Nov 2019.
  it('walks every page when the server truncates a large p_size', async () => {
    const { calls } = stubApi(2458);

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(9999));

    expect(results).toHaveLength(2458);
    expect(results[0].id).toBe(0);
    expect(results[2457].id).toBe(2457);
    expect(calls).toHaveLength(3);
  });

  it('builds https page URLs rather than following the API https-less `next`', async () => {
    const { calls } = stubApi(2458);

    await fetchBaLabsPages<{ id: number }>(urlFor(9999));

    expect(calls.every(href => href.startsWith('https://'))).toBe(true);
    expect(calls[1]).toContain('p=2');
    expect(calls[2]).toContain('p=3');
  });

  it('makes a single request when the caller only wants the latest row', async () => {
    const { calls } = stubApi(2458);

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(1));

    expect(results).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("stops at the caller's row budget instead of draining the endpoint", async () => {
    const { calls } = stubApi(2458);

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(366));

    expect(results).toHaveLength(366);
    expect(calls).toHaveLength(1);
  });

  it('makes a single request when the first page already holds the series', async () => {
    const { calls } = stubApi(400);

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(9999));

    expect(results).toHaveLength(400);
    expect(calls).toHaveLength(1);
  });

  it('returns the pages that resolved when a later page fails', async () => {
    const { fetchMock } = stubApi(2458);
    const realFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: URL | RequestInfo) => {
      if (String(input).includes('p=3')) throw new Error('network down');
      return realFetch(input);
    });

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(9999));

    expect(results).toHaveLength(2000);
  });

  it('does not stitch a hole into the middle of the series', async () => {
    const { fetchMock } = stubApi(2458);
    const realFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: URL | RequestInfo) => {
      if (String(input).includes('p=2')) throw new Error('network down');
      return realFetch(input);
    });

    const results = await fetchBaLabsPages<{ id: number }>(urlFor(9999));

    // Page 3 resolved, but appending it after page 1 would fabricate a jump.
    expect(results).toHaveLength(1000);
  });

  it('returns an empty series when the very first page fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response)
    );

    await expect(fetchBaLabsPages<{ id: number }>(urlFor(9999))).resolves.toEqual([]);
  });
});
