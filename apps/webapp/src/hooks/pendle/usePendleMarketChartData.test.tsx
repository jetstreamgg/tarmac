/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePendleMarketChartData } from './usePendleMarketChartData';

const MARKET = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc' as `0x${string}`;

const RESPONSE = {
  total: 3,
  timestamp_start: '2026-05-15T00:00:00.000Z',
  timestamp_end: '2026-05-17T00:00:00.000Z',
  results: [
    // Out of order on purpose — the hook must sort ascending.
    { timestamp: '2026-05-16T00:00:00.000Z', impliedApy: 0.04, underlyingApy: 0.03, tvl: 2_000_000 },
    { timestamp: '2026-05-15T00:00:00.000Z', impliedApy: 0.035, underlyingApy: 0.029, tvl: 1_000_000 },
    { timestamp: '2026-05-17T00:00:00.000Z', impliedApy: 0.045, underlyingApy: 0.031, tvl: 3_000_000 }
  ]
};

const fetchMock = vi.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePendleMarketChartData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: async () => RESPONSE });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('fetches the daily historical series for the market and maps it sorted ascending', async () => {
    const { result } = renderHook(() => usePendleMarketChartData(MARKET), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`/v2/1/markets/${MARKET}/historical-data`);
    expect(url).toContain('time_frame=day');

    const points = result.current.data!;
    expect(points.map(p => p.impliedApy)).toEqual([0.035, 0.04, 0.045]);
    expect(points.map(p => p.tvl)).toEqual([1_000_000, 2_000_000, 3_000_000]);
    expect(points[0].timestampSec).toBe(Math.floor(Date.parse('2026-05-15T00:00:00.000Z') / 1000));
  });

  it('does not fetch when no market is given', async () => {
    const { result } = renderHook(() => usePendleMarketChartData(undefined), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces transport errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const { result } = renderHook(() => usePendleMarketChartData(MARKET), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
