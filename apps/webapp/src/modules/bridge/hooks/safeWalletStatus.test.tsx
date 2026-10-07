/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSafeWalletStatus } from '@/hooks/wallet/useIsSafeWallet';

vi.mock('wagmi', () => ({
  useConnection: () => ({
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    connector: { id: 'injected' }
  }),
  useChainId: () => 1
}));

// The bridge gates Review on this shared hook: a Safe service outage must surface fast, not after 3 retries.
describe('useSafeWalletStatus when the Safe service is down', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries once and then reports unknown', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    // App defaults: lib/queryClient.ts builds a plain QueryClient.
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSafeWalletStatus(), { wrapper });

    await waitFor(() => expect(result.current).toBe('unknown'), { timeout: 2500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
