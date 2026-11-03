import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiProvider } from 'wagmi';
import { readContractQueryKey, simulateContractQueryKey } from 'wagmi/query';
import { mainnet } from 'wagmi/chains';
import { custom, numberToHex } from 'viem';
import { useTokenAllowance } from '@/hooks/tokens/useTokenAllowance';
import { clearUnusedTxInputs } from './clearUnusedTxInputs';

const TOKEN = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const OWNER = '0x0000000000000000000000000000000000000001';
const SPENDER = '0x0000000000000000000000000000000000000002';

// Built with wagmi's own key builders, so a change to its key shape fails here.
const read = (functionName: string) =>
  readContractQueryKey({ address: TOKEN, chainId: 1, functionName, args: [] });

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

describe('allowance and transaction-input freshness (APP-675)', () => {
  it('re-reads the allowance when a flow mounts again, rather than keeping the cached value', async () => {
    const { chain, mount } = setup();
    const first = mount();
    await waitFor(() => expect(first.result.current.data).toBe(100n));
    first.unmount();

    chain.allowance = 0n;
    const next = mount();

    await waitFor(() => expect(next.result.current.data).toBe(0n));
  });

  it('after a launch clears unused inputs, a new flow never sees the pre-spend allowance', async () => {
    const { chain, client, mount, seen } = setup();
    const first = mount();
    await waitFor(() => expect(first.result.current.data).toBe(100n));
    first.unmount();

    chain.allowance = 0n;
    clearUnusedTxInputs(client);
    seen.length = 0;
    const next = mount();

    await waitFor(() => expect(next.result.current.data).toBe(0n));
    expect(seen).not.toContain(100n);
  });

  it('leaves reads that are on screen alone', async () => {
    const { client, mount } = setup();
    const { result } = mount();
    await waitFor(() => expect(result.current.data).toBe(100n));

    clearUnusedTxInputs(client);

    expect(client.getQueryCache().findAll({ queryKey: ['readContract'] })).toHaveLength(1);
    expect(result.current.data).toBe(100n);
  });

  it('clears unused allowances, dry runs and quotes, and nothing else', () => {
    const client = new QueryClient();
    const dryRun = simulateContractQueryKey({
      address: TOKEN,
      chainId: 1,
      functionName: 'deposit',
      args: []
    });
    const cleared = [
      read('allowance'),
      read('get_dy'),
      read('get_dx'),
      dryRun,
      ['simulate-batch', 1, OWNER, 'calls'],
      ['pendle-convert', TOKEN]
    ];
    for (const key of cleared) client.setQueryData(key, 1n);
    client.setQueryData(read('balanceOf'), 7n);

    clearUnusedTxInputs(client);

    for (const key of cleared) expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(read('balanceOf'))).toBe(7n);
  });
});
