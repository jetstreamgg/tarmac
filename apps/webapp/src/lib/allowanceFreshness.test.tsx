import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiProvider } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { custom, numberToHex } from 'viem';
import { useTokenAllowance } from '@/hooks/tokens/useTokenAllowance';

const TOKEN = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const OWNER = '0x0000000000000000000000000000000000000001';
const SPENDER = '0x0000000000000000000000000000000000000002';

function setup() {
  const chain = { allowance: 100n };
  const config = createConfig({
    chains: [mainnet],
    batch: { multicall: false },
    transports: {
      [mainnet.id]: custom(
        {
          request: async ({ method }) => {
            if (method === 'eth_chainId') return numberToHex(mainnet.id);
            if (method === 'eth_call') return numberToHex(chain.allowance, { size: 32 });
            throw new Error(`unexpected ${method}`);
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
        const allowance = useTokenAllowance({
          chainId: 1,
          contractAddress: TOKEN,
          owner: OWNER,
          spender: SPENDER
        });
        seen.push(allowance.data);
        return allowance;
      },
      { wrapper }
    );
  return { chain, client, mount, seen };
}

describe('allowance freshness (APP-675)', () => {
  it('a flow mounting after the last reader unmounted never sees the old allowance', async () => {
    const { chain, client, mount, seen } = setup();
    const first = mount();
    await waitFor(() => expect(first.result.current.data).toBe(100n));
    first.unmount();
    await waitFor(() => expect(client.getQueryCache().findAll()).toHaveLength(0));

    chain.allowance = 0n;
    seen.length = 0;
    const next = mount();

    await waitFor(() => expect(next.result.current.data).toBe(0n));
    expect(seen).not.toContain(100n);
  });

  it('keeps the allowance while something on screen reads it', async () => {
    const { client, mount } = setup();
    const onScreen = mount();
    await waitFor(() => expect(onScreen.result.current.data).toBe(100n));

    const other = mount();
    other.unmount();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(client.getQueryCache().findAll()).toHaveLength(1);
    expect(onScreen.result.current.data).toBe(100n);
  });
});
