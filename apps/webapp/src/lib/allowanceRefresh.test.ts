import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { readContractQueryKey } from 'wagmi/query';
import { refreshAllowancesAfterTx } from './allowanceRefresh';

// Built with wagmi's own key builder, so a change to its key shape fails here.
const read = (functionName: 'allowance' | 'balanceOf') =>
  readContractQueryKey({
    address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    chainId: 1,
    functionName,
    args: []
  });

describe('refreshAllowancesAfterTx', () => {
  it('resets allowance reads and leaves other reads alone', async () => {
    const client = new QueryClient();
    client.setQueryData(read('allowance'), 5n);
    client.setQueryData(read('balanceOf'), 7n);

    await refreshAllowancesAfterTx(client);

    expect(client.getQueryData(read('allowance'))).toBeUndefined();
    expect(client.getQueryData(read('balanceOf'))).toBe(7n);
  });
});
