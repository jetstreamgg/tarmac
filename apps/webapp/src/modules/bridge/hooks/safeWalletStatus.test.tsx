/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSafeAccount } from '@/hooks/wallet/safeAccount';
import { useSafeWalletStatus } from '@/hooks/wallet/useIsSafeWallet';
import { useSafeConfig } from './useSafeConfig';

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

vi.mock('wagmi', () => ({
  useConnection: () => ({
    address: ADDRESS,
    connector: { id: 'injected' }
  }),
  useChainId: () => 1
}));

const appClient = () => {
  // App defaults: lib/queryClient.ts builds a plain QueryClient.
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

// The bridge gates Review on this shared hook: a Safe service outage must surface fast, not after 3 retries.
describe('useSafeWalletStatus when the Safe service is down', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries once and then reports unknown', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSafeWalletStatus(), { wrapper: appClient() });

    await waitFor(() => expect(result.current).toBe('unknown'), { timeout: 2500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('readSafeAccount', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads a Safe with its config, and null when there is none', async () => {
    vi.stubGlobal('fetch', reply(200, { owners: ['0x1', '0x2'], threshold: 2, nonce: 3 }));
    expect(await readSafeAccount({ chainId: 1, address: '0xa' })).toEqual({
      config: { owners: ['0x1', '0x2'], threshold: 2 }
    });
    vi.stubGlobal('fetch', reply(404));
    expect(await readSafeAccount({ chainId: 1, address: '0xb' })).toBeNull();
  });

  it('keeps a Safe whose body it cannot read, without a config', async () => {
    vi.stubGlobal('fetch', reply(200, { owners: 'nope' }));
    expect(await readSafeAccount({ chainId: 1, address: '0xa' })).toEqual({ config: undefined });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 200 }))
    );
    expect(await readSafeAccount({ chainId: 1, address: '0xa' })).toEqual({ config: undefined });
  });

  it('throws when it cannot tell, so callers fail closed', async () => {
    vi.stubGlobal('fetch', reply(500));
    await expect(readSafeAccount({ chainId: 1, address: '0xa' })).rejects.toThrow();
    vi.stubGlobal('fetch', reply(302, { owners: ['0x1'], threshold: 1 }));
    await expect(readSafeAccount({ chainId: 1, address: '0xa' })).rejects.toThrow();
    await expect(readSafeAccount({ chainId: 43114, address: '0xa' })).rejects.toThrow();
  });
});

describe('the wallet status and the bridge Safe config', () => {
  afterEach(() => vi.unstubAllGlobals());

  const useBoth = (address: string) => ({
    status: useSafeWalletStatus(),
    config: useSafeConfig({ address, chainId: 1, enabled: true })
  });

  it('ask the Safe service once, whatever the address case', async () => {
    const fetchMock = reply(200, { owners: ['0x1', '0x2'], threshold: 2 });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBoth(ADDRESS.toLowerCase()), { wrapper: appClient() });

    await waitFor(() => expect(result.current.status).toBe('safe'));
    expect(result.current.config).toEqual({
      lookup: { owners: ['0x1', '0x2'], threshold: 2 },
      isChecking: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('agree there is no Safe on a 404', async () => {
    vi.stubGlobal('fetch', reply(404));

    const { result } = renderHook(() => useBoth(ADDRESS), { wrapper: appClient() });

    await waitFor(() => expect(result.current.status).toBe('not-safe'));
    expect(result.current.config).toEqual({ lookup: null, isChecking: false });
  });

  it('read a Safe with an unreadable body as a Safe whose config is unknown', async () => {
    vi.stubGlobal('fetch', reply(200, { owners: 'nope' }));

    const { result } = renderHook(() => useBoth(ADDRESS), { wrapper: appClient() });

    await waitFor(() => expect(result.current.status).toBe('safe'));
    expect(result.current.config).toEqual({ lookup: undefined, isChecking: false });
  });
});
