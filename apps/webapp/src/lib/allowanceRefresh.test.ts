import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshAllowancesAfterTx } from './allowanceRefresh';

const read = (functionName: string) => ['readContract', { chainId: 1, functionName, args: [] }];

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
