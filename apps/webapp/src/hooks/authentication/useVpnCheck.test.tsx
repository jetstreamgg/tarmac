import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVpnCheck } from './useVpnCheck';

const renderVpnCheck = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useVpnCheck({ authUrl: 'https://auth.test', refetchInterval: 0 }), { wrapper });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useVpnCheck', () => {
  // react-query resets a query with no data to pending (and clears `error`) on
  // every refetch, which would read as a first load and drop the gate.
  it('stays failed, not loading, while a failed check retries, until one succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderVpnCheck();
    await waitFor(() => expect(result.current.hasFailed).toBe(true));

    let succeed!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => (succeed = resolve)));
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () =>
      succeed({
        ok: true,
        json: async () => ({ country_code: 'DE', is_vpn: false, is_restricted_region: false })
      })
    );

    await waitFor(() => expect(result.current.data?.countryCode).toBe('DE'));
    expect(result.current.hasFailed).toBe(false);
  });
});
