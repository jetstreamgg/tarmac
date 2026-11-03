import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiProvider } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { custom, numberToHex } from 'viem';
import { useTokenAllowance } from '@/hooks/tokens/useTokenAllowance';

// In the fast suite: tests under src/hooks run against the Tenderly vnets.

const TOKEN = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const OWNER = '0x0000000000000000000000000000000000000001';
const SPENDER = '0x0000000000000000000000000000000000000002';

function setup() {
  const chain = { allowance: 100n as bigint | Error };
  const config = createConfig({
    chains: [mainnet],
    batch: { multicall: false },
    transports: {
      [mainnet.id]: custom(
        {
          request: async ({ method }) => {
            if (method === 'eth_chainId') return numberToHex(mainnet.id);
            if (method !== 'eth_call') throw new Error(`unexpected ${method}`);
            if (chain.allowance instanceof Error) throw chain.allowance;
            return numberToHex(chain.allowance, { size: 32 });
          }
        },
        { retryCount: 0 }
      )
    }
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
  const seen: (bigint | undefined)[] = [];
  const mount = () =>
    renderHook(
      () => {
        const read = useTokenAllowance({
          chainId: 1,
          contractAddress: TOKEN,
          owner: OWNER,
          spender: SPENDER
        });
        seen.push(read.data);
        return read;
      },
      { wrapper }
    );
  return { chain, mount, seen };
}

describe('useTokenAllowance freshness (APP-675)', () => {
  it('a new mount waits for a fresh read instead of handing out the cached allowance', async () => {
    const { chain, mount, seen } = setup();
    const first = mount();
    await waitFor(() => expect(first.result.current.data).toBe(100n));
    first.unmount();

    // The deposit spends the approval; the cache still holds 100n and is inside its 30s staleTime.
    chain.allowance = 0n;
    seen.length = 0;
    const next = mount();

    await waitFor(() => expect(next.result.current.data).toBe(0n));
    expect(seen).not.toContain(100n);
  });

  it('reports no allowance when the fresh read fails, rather than the cached one', async () => {
    const { chain, mount } = setup();
    const first = mount();
    await waitFor(() => expect(first.result.current.data).toBe(100n));
    first.unmount();

    chain.allowance = new Error('rpc down');
    const next = mount();

    await waitFor(() => expect(next.result.current.error).toBeTruthy());
    expect(next.result.current.data).toBeUndefined();
  });
});
