import { describe, expect, it } from 'vitest';
import { createPublicClient, custom, fallback, type EIP1193RequestFn, type Hex } from 'viem';
import { cctpL2Contracts } from './contracts';
import { cctpResumeRefusal } from './gate';

// The app's transport falls back to a second RPC backend per request: a log
// query the first one fails can land on one that hasn't indexed the burn yet.
describe('cctpResumeRefusal behind a fallback transport whose backends disagree', () => {
  const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
  const RECIPIENT = '0x00000000000000000000000000000000000b0b01';
  const USDC_AMOUNT = 250n * 10n ** 6n;
  const SWAP = ('0x' + 'ab'.repeat(32)) as Hex;
  const { psm3 } = cctpL2Contracts('base');
  const SWAP_BLOCK = 100n;
  const HEAD = 200n;

  const backend = ({ logs }: { logs: 'none' | 'fails' }): EIP1193RequestFn =>
    (async ({ method }: { method: string }) => {
      if (method === 'eth_blockNumber') return `0x${HEAD.toString(16)}`;
      if (method === 'eth_getTransactionReceipt')
        return {
          transactionHash: SWAP,
          status: '0x1',
          from: ACCOUNT,
          to: psm3,
          blockNumber: `0x${SWAP_BLOCK.toString(16)}`,
          logs: []
        };
      if (method === 'eth_getLogs') {
        if (logs === 'fails') throw new Error('upstream timeout');
        return [];
      }
      throw new Error(`unexpected ${method}`);
    }) as EIP1193RequestFn;

  const client = (primary: EIP1193RequestFn, second: EIP1193RequestFn) =>
    createPublicClient({
      transport: fallback([custom({ request: primary }), custom({ request: second })])
    });

  const refusal = (c: ReturnType<typeof client>) =>
    cctpResumeRefusal({
      network: 'base',
      swapTxHash: SWAP,
      account: ACCOUNT,
      usdcAmount: USDC_AMOUNT,
      recipient: RECIPIENT,
      client: c
    }).catch((error: unknown) => error);

  it('continues when the backend that answers the head also answers the logs', async () => {
    await expect(
      refusal(client(backend({ logs: 'none' }), backend({ logs: 'none' })))
    ).resolves.toBeUndefined();
  });

  it('never continues on the empty logs of a backend other than the one that read the head', async () => {
    // The first backend has the burn but fails its log query; the second has not indexed it.
    const result = await refusal(client(backend({ logs: 'fails' }), backend({ logs: 'none' })));
    expect(result).toBeInstanceOf(Error);
  });
});
