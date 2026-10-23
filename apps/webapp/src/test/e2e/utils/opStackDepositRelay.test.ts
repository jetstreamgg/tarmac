import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodePacked,
  parseAbi,
  toHex,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { base } from 'viem/chains';
import { readOpStackDeposit, sendOpStackDeposit } from './opStackDepositRelay';

const portalAbi = parseAbi([
  'event TransactionDeposited(address indexed from, address indexed to, uint256 indexed version, bytes opaqueData)'
]);
const FROM: Address = '0x36BDE71C97B33Cc4729cf772aE268934f7AB70B2';
const TO: Address = '0x4200000000000000000000000000000000000007';
const DATA: Hex = '0xd764ad0b0001';
const L1_TX = `0x${'11'.repeat(32)}` as Hex;
const RELAY_TX = `0x${'22'.repeat(32)}` as Hex;

const depositLog = (address: Address = base.contracts.portal[1].address): Log =>
  ({
    address,
    topics: encodeEventTopics({
      abi: portalAbi,
      eventName: 'TransactionDeposited',
      args: { from: FROM, to: TO, version: 0n }
    }),
    data: encodeAbiParameters(
      [{ type: 'bytes' }],
      [encodePacked(['uint256', 'uint256', 'uint64', 'bool', 'bytes'], [0n, 0n, 287_000n, false, DATA])]
    )
  }) as unknown as Log;

const l1 = (logs: Log[], status: 'success' | 'reverted' = 'success') => ({
  getTransactionReceipt: vi.fn(async () => ({ status, logs }))
});

const stubFork = () => {
  const calls: { method: string; params: unknown[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const { method, params } = JSON.parse(init.body as string);
      calls.push({ method, params });
      return new Response(JSON.stringify({ result: method === 'eth_sendTransaction' ? RELAY_TX : true }));
    })
  );
  return calls;
};

describe('OP Stack deposit relay on the Tenderly forks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the exact L2 deposit transaction of the L1 deposit', async () => {
    const calls = stubFork();
    const deposit = await readOpStackDeposit(l1([depositLog()]) as never, L1_TX);
    const l2 = { waitForTransactionReceipt: vi.fn(async () => ({ status: 'success', logs: [] })) };
    await sendOpStackDeposit(l2 as never, 'fork-rpc', deposit);
    expect(calls.at(-1)).toEqual({
      method: 'eth_sendTransaction',
      params: [{ from: FROM, to: TO, gas: toHex(287_000n), value: '0x0', data: DATA }]
    });
    expect(l2.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: RELAY_TX });
  });

  it('sends the gas it is given instead, to leave a failed message to replay', async () => {
    const calls = stubFork();
    const deposit = await readOpStackDeposit(l1([depositLog()]) as never, L1_TX);
    const l2 = { waitForTransactionReceipt: vi.fn(async () => ({ status: 'success', logs: [] })) };
    await sendOpStackDeposit(l2 as never, 'fork-rpc', deposit, { gas: 150_000n });
    expect(calls.at(-1)?.params).toEqual([expect.objectContaining({ gas: toHex(150_000n) })]);
  });

  it('finds nothing to relay without a TransactionDeposited log', async () => {
    await expect(readOpStackDeposit(l1([]) as never, L1_TX)).rejects.toThrow('No TransactionDeposited log');
  });
});
