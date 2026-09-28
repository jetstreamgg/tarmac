import { renderHook } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  addressScreeningQueryKey,
  RISKY_SCREENING_REPOLL_MS,
  useRestrictedAddressCheck
} from '@/hooks/authentication/useRestrictedAddressCheck';

/**
 * The screening query's polling, against a real query client. Lives beside
 * ConnectedContext (its one consumer) because `src/hooks` tests only run in
 * the vnet-backed suite, and this needs no chain.
 *
 * Every screening can bill the provider, so the query never polls — except a
 * cached RISKY verdict, which re-polls even while the caller has the query
 * disabled: the pre-transaction gate writes that verdict, and the blocked
 * screen offers no retry of its own.
 */

const ADDRESS = '0x1234567890123456789012345678901234567890';
const AUTH_URL = 'https://auth.test';

let queryClient: QueryClient;
const fetchMock = vi.fn();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const respond = (addressAllowed: boolean) =>
  fetchMock.mockResolvedValue({ status: 200, json: async () => ({ addressAllowed }) });

const seed = (addressAllowed: boolean) =>
  queryClient.setQueryData(addressScreeningQueryKey(ADDRESS), { addressAllowed });

const renderCheck = (enabled: boolean) =>
  renderHook(() => useRestrictedAddressCheck({ address: ADDRESS, authUrl: AUTH_URL, enabled }), { wrapper });

// The observer's notify rides a short timer of its own, so each interval step
// is followed by a small extra advance before anything is asserted.
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(1_000);
};

describe('useRestrictedAddressCheck polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    focusManager.setFocused(true);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
    focusManager.setFocused(undefined);
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it('re-polls a cached risky verdict while disabled, and stops once it clears', async () => {
    seed(false);
    respond(true);
    const { result } = renderCheck(false);

    await advance(RISKY_SCREENING_REPOLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ addressAllowed: true });

    await advance(3 * RISKY_SCREENING_REPOLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps re-polling while the verdict stays risky', async () => {
    seed(false);
    respond(false);
    renderCheck(false);

    await advance(RISKY_SCREENING_REPOLL_MS);
    await advance(RISKY_SCREENING_REPOLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never polls an allowed verdict, enabled or not', async () => {
    seed(true);
    renderCheck(false);
    renderCheck(true);

    await advance(3 * RISKY_SCREENING_REPOLL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never fetches while disabled with nothing cached', async () => {
    renderCheck(false);

    await advance(3 * RISKY_SCREENING_REPOLL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
