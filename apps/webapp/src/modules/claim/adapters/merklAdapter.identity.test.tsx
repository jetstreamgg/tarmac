import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

/**
 * Referential-stability guard for the Merkl claim read.
 *
 * `ClaimRewardsPanel` feeds the adapters' `rewards` into a memo → the wallet-screen
 * `transactionScreenContent` → `useModalEntryBody`'s sync effect → `updateModalContent`,
 * which always allocates a new config and so always re-renders every consumer of the
 * transaction context — the panel included. Anything in this hook that churns per
 * render therefore closes that circle into an unbounded loop, and because the setState
 * lives in a passive effect React never throws "Maximum update depth": the tab just
 * spins at 100% CPU, which no fork test will show. `exhaustive-deps` can't catch it
 * either (a fresh array literal in a dep list is legal), hence this test.
 *
 * The sibling adapter tests mock `@/hooks` wholesale, so they can't see this — these
 * run the real hook over a mocked wagmi/fetch layer.
 */

const noopRefetch = () => {};

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: '0x1111111111111111111111111111111111111111' }),
    useReadContracts: () => ({ data: undefined, isLoading: false, error: null, refetch: noopRefetch })
  };
});

import { useMerklRewards } from '@/hooks/morpho/useMerklRewards';
import { merklAdapter } from './merklAdapter';

// One client for the whole file: a per-render `new QueryClient()` would itself churn
// `useQueryClient` and make these assertions test the harness rather than the hook.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  queryClient.clear();
});

describe('useMerklRewards identity', () => {
  it('keeps `mutate` stable across renders', () => {
    const { result, rerender } = renderHook(() => useMerklRewards(), { wrapper });
    const first = result.current.mutate;

    rerender();

    expect(result.current.mutate).toBe(first);
  });

  it('keeps the adapter rewards array stable across renders — including when empty', () => {
    const scope = { kind: 'merkl' } as const;
    const { result, rerender } = renderHook(() => merklAdapter.useClaimable(scope), { wrapper });
    const first = result.current.rewards;

    rerender();

    expect(result.current.rewards).toEqual([]);
    expect(result.current.rewards).toBe(first);
  });
});
