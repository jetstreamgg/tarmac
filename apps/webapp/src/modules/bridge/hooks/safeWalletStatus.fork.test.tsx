/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSafeWalletStatus } from '@/hooks/wallet/useIsSafeWallet';
import { forkChainId } from '@/utils/chainId';

const mocks = vi.hoisted(() => ({ chainId: 0 }));

vi.mock('@/data/wagmi/config/forkChains', () => ({
  forkL2Chains: [],
  forkL2ChainIds: [9998453, 99942161, 99910, 999130]
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    connector: { id: 'injected' }
  }),
  useChainId: () => mocks.chainId
}));

const appClient = () => {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

// The bridge blocks Review while the wallet type is unknown: a fork L2 must resolve it like its real L2.
describe('useSafeWalletStatus on the Tenderly multichain fork L2s', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(Object.keys(forkChainId) as (keyof typeof forkChainId)[])(
    'resolves an EOA on the fork %s through its real L2 Safe service',
    async network => {
      const urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          urls.push(url);
          return new Response(null, { status: 404 });
        })
      );
      mocks.chainId = forkChainId[network];
      const { result } = renderHook(() => useSafeWalletStatus(), { wrapper: appClient() });

      await waitFor(() => expect(result.current).toBe('not-safe'));
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every(url => url.startsWith(`https://safe-transaction-${network}.safe.global/`))).toBe(
        true
      );
    }
  );
});
