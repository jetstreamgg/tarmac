/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('../helpers/getIndexerUrl', () => ({ getBaLabsApiUrl: () => 'https://balabs.test/api/v1' }));
vi.mock('../helpers', () => ({
  fetchBaLabsPages: vi.fn(),
  formatBaLabsUrl: (url: URL) => url
}));

import { fetchBaLabsPages } from '../helpers';
import { useBaLabsHistoric } from './useBaLabsHistoric';

type Point = { size: string };

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useBaLabsHistoric — timeframe switches (APP-407)', () => {
  let resolvers: Array<(rows: Point[]) => void>;

  beforeEach(() => {
    resolvers = [];
    vi.mocked(fetchBaLabsPages).mockImplementation(
      () => new Promise(resolve => resolvers.push(resolve as (rows: unknown[]) => void))
    );
  });

  const render = (initial: { path: string; limit: number }) =>
    renderHook(
      ({ path, limit }) =>
        useBaLabsHistoric<Point, Point>({ path, limit, queryKey: 'series', transform: rows => rows }),
      { initialProps: initial, wrapper: makeWrapper() }
    );

  it('keeps the current series, not the skeleton, while a new timeframe loads', async () => {
    const { result, rerender } = render({ path: '/farm/a/', limit: 7 });
    resolvers[0]([{ size: '7' }]);
    await waitFor(() => expect(result.current.data).toEqual([{ size: '7' }]));

    rerender({ path: '/farm/a/', limit: 365 });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([{ size: '7' }]);
    expect(result.current.isPlaceholderData).toBe(true);

    resolvers[1]([{ size: '365' }]);
    await waitFor(() => expect(result.current.data).toEqual([{ size: '365' }]));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('does not carry one series over to another (different farm)', async () => {
    const { result, rerender } = render({ path: '/farm/a/', limit: 7 });
    resolvers[0]([{ size: '7' }]);
    await waitFor(() => expect(result.current.data).toEqual([{ size: '7' }]));

    rerender({ path: '/farm/b/', limit: 7 });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('does not hand a disabled caller the series an enabled one cached', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useBaLabsHistoric<Point, Point>({
          path: '/farm/a/',
          limit: 7,
          queryKey: 'series',
          transform: rows => rows,
          enabled
        }),
      { initialProps: { enabled: true }, wrapper: makeWrapper() }
    );
    resolvers[0]([{ size: '7' }]);
    await waitFor(() => expect(result.current.data).toEqual([{ size: '7' }]));

    rerender({ enabled: false });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });
});
