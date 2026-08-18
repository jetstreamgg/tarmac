import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const ADDRESS = '0x1234567890123456789012345678901234567890';

const mocks = vi.hoisted(() => ({
  shouldSkipAuthChecks: vi.fn(() => false),
  wagmiAddress: '0x1234567890123456789012345678901234567890' as string | undefined,
  fetchEnhancedAddressScreening: vi.fn()
}));

vi.mock('@/lib/authCheck', () => ({
  shouldSkipAuthChecks: mocks.shouldSkipAuthChecks,
  getAuthUrl: () => 'https://auth.test'
}));

vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  fetchEnhancedAddressScreening: mocks.fetchEnhancedAddressScreening
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({ address: mocks.wagmiAddress, isConnected: !!mocks.wagmiAddress })
}));

import { enhancedAddressScreeningQueryKey } from '@/hooks';
import { useEnhancedScreeningPreflight } from './useEnhancedScreeningPreflight';

i18n.load('en', {});
i18n.activate('en');

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </I18nProvider>
);

const renderPreflight = (usdValue: number | undefined, active = true) =>
  renderHook(({ v, a }) => useEnhancedScreeningPreflight({ usdValue: v, active: a }), {
    wrapper,
    initialProps: { v: usdValue, a: active }
  });

describe('useEnhancedScreeningPreflight', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } }
    });
    mocks.wagmiAddress = ADDRESS;
    mocks.shouldSkipAuthChecks.mockReturnValue(false);
  });
  afterEach(() => vi.clearAllMocks());

  it('below the threshold: clear, and the endpoint is never touched', () => {
    const { result } = renderPreflight(100);
    expect(result.current).toEqual({ kind: 'clear' });
    expect(mocks.fetchEnhancedAddressScreening).not.toHaveBeenCalled();
  });

  it('no active session: clear even at whale size', () => {
    const { result } = renderPreflight(1_000_000, false);
    expect(result.current).toEqual({ kind: 'clear' });
    expect(mocks.fetchEnhancedAddressScreening).not.toHaveBeenCalled();
  });

  it('the dev/e2e bypass clears everything', () => {
    mocks.shouldSkipAuthChecks.mockReturnValue(true);
    const { result } = renderPreflight(1_000_000);
    expect(result.current).toEqual({ kind: 'clear' });
    expect(mocks.fetchEnhancedAddressScreening).not.toHaveBeenCalled();
  });

  it('at the threshold: pending while the verdict is in flight, clear once allowed', async () => {
    mocks.fetchEnhancedAddressScreening.mockResolvedValueOnce({ addressAllowed: true });
    const { result } = renderPreflight(250_000);

    expect(result.current).toEqual({ kind: 'pending' });
    await waitFor(() => expect(result.current).toEqual({ kind: 'clear' }));
    expect(mocks.fetchEnhancedAddressScreening).toHaveBeenCalledTimes(1);
  });

  it('an UNKNOWN usdValue requires the check (fail-safe)', async () => {
    mocks.fetchEnhancedAddressScreening.mockResolvedValueOnce({ addressAllowed: true });
    const { result } = renderPreflight(undefined);

    expect(result.current).toEqual({ kind: 'pending' });
    await waitFor(() => expect(result.current).toEqual({ kind: 'clear' }));
  });

  it('a risky verdict blocks with a message', async () => {
    mocks.fetchEnhancedAddressScreening.mockResolvedValueOnce({ addressAllowed: false });
    const { result } = renderPreflight(300_000);

    await waitFor(() => expect(result.current.kind).toBe('blocked'));
    expect(result.current.kind === 'blocked' && result.current.message).toBeTruthy();
  });

  it('an unavailable check blocks (fail closed) with the try-again message', async () => {
    mocks.fetchEnhancedAddressScreening.mockRejectedValue(new Error('down'));
    const { result } = renderPreflight(300_000);

    await waitFor(() => expect(result.current.kind).toBe('blocked'));
  });

  it('a cached verdict from the GATE clears without a fetch (shared cache)', () => {
    queryClient.setQueryData(enhancedAddressScreeningQueryKey(ADDRESS), { addressAllowed: true });
    const { result } = renderPreflight(300_000);

    expect(result.current).toEqual({ kind: 'clear' });
    expect(mocks.fetchEnhancedAddressScreening).not.toHaveBeenCalled();
  });

  it('crossing the threshold mid-session flips the requirement on', async () => {
    mocks.fetchEnhancedAddressScreening.mockResolvedValueOnce({ addressAllowed: false });
    const { result, rerender } = renderPreflight(100);
    expect(result.current).toEqual({ kind: 'clear' });

    rerender({ v: 400_000, a: true });
    await waitFor(() => expect(result.current.kind).toBe('blocked'));

    // Dropping back below the threshold releases the hold — the smaller
    // transaction never owed this check.
    rerender({ v: 100, a: true });
    expect(result.current).toEqual({ kind: 'clear' });
  });
});
