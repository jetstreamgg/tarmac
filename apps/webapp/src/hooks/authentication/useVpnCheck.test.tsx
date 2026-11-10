import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVpnCheck } from './useVpnCheck';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVpnCheck', () => {
  // react-query resets a query with no data to pending (and clears `error`) on
  // every refetch, which would read as a first load and drop the gate.
  it('stays failed, not loading, while a failed check retries', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useVpnCheck({ authUrl: 'https://auth.test', refetchInterval: 0 }), {
      wrapper
    });

    await waitFor(() => expect(result.current.hasFailed).toBe(true));

    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears the failure once the check succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useVpnCheck({ authUrl: 'https://auth.test', refetchInterval: 0 }), {
      wrapper
    });
    await waitFor(() => expect(result.current.hasFailed).toBe(true));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ country_code: 'DE', is_vpn: false, is_restricted_region: false })
    });
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data?.countryCode).toBe('DE'));
    expect(result.current.hasFailed).toBe(false);
  });
});
