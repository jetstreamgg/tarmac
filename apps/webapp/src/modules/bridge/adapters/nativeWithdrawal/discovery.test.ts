import { describe, expect, it, vi } from 'vitest';
import type { Hex, Log } from 'viem';
import { ARBITRUM_DEPOSIT, OP_STACK_DEPOSIT } from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import { arbitrumWithdrawalMessage } from './arbitrum';
import { discoverNativeWithdrawals, WITHDRAWAL_SCAN_BLOCKS, withdrawalsInLogs } from './discovery';
import { opStackWithdrawalMessage } from './opStack';
import {
  ARBITRUM_WITHDRAWAL_LOGS,
  BASE_WITHDRAWAL_LOGS,
  OPTIMISM_WITHDRAWAL_LOGS
} from './withdrawalFixtures';

const HASH = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const mined = (logs: Log[], txHash: Hex, blockNumber = 100n) =>
  logs.map(log => ({ ...log, transactionHash: txHash, blockNumber, removed: false }) as Log);
const base = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const optimism = opStackWithdrawalMessage(OPTIMISM_WITHDRAWAL_LOGS, 'optimism')!;
const arbitrum = arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!;

describe('withdrawalsInLogs', () => {
  it("finds an OP Stack USDS withdrawal by its sender or its recipient, not another token's", () => {
    // The Base fixture also withdraws sUSDS in the same transaction.
    const logs = mined(BASE_WITHDRAWAL_LOGS, HASH(1), 7n);
    expect(withdrawalsInLogs(logs, 'base', base.from)).toEqual([{ txHash: HASH(1), blockNumber: 7n }]);
    expect(withdrawalsInLogs(logs, 'base', base.to)).toEqual([{ txHash: HASH(1), blockNumber: 7n }]);
    expect(withdrawalsInLogs(logs, 'base', OTHER)).toEqual([]);
    expect(
      withdrawalsInLogs(mined(OPTIMISM_WITHDRAWAL_LOGS, HASH(2)), 'optimism', optimism.from)
    ).toHaveLength(1);
  });

  it("ignores another network's bridge and a removed log", () => {
    expect(withdrawalsInLogs(mined(BASE_WITHDRAWAL_LOGS, HASH(1)), 'optimism', base.from)).toEqual([]);
    const removed = mined(BASE_WITHDRAWAL_LOGS, HASH(1)).map(log => ({ ...log, removed: true }) as Log);
    expect(withdrawalsInLogs(removed, 'base', base.from)).toEqual([]);
  });

  it('finds an Arbitrum USDS withdrawal by its sender or its recipient, once per transaction', () => {
    const logs = [...mined(ARBITRUM_WITHDRAWAL_LOGS, HASH(3)), ...mined(ARBITRUM_WITHDRAWAL_LOGS, HASH(3))];
    expect(withdrawalsInLogs(logs, 'arbitrum', arbitrum.from)).toEqual([
      { txHash: HASH(3), blockNumber: 100n }
    ]);
    expect(withdrawalsInLogs(logs, 'arbitrum', arbitrum.to)).toHaveLength(1);
    expect(withdrawalsInLogs(logs, 'arbitrum', OTHER)).toEqual([]);
  });
});

describe('discoverNativeWithdrawals', () => {
  const reader = (getLogs: (args: { fromBlock: bigint; toBlock: bigint }) => Promise<Log[]>) => {
    const mock = vi.fn(getLogs);
    return { getLogs: mock as unknown as ChainReader['getLogs'], read: mock };
  };

  it("scans the network's whole window in one query, by token only on the OP Stack bridge", async () => {
    const window = WITHDRAWAL_SCAN_BLOCKS.base;
    const toBlock = window * 2n;
    const l2 = reader(async () => mined(BASE_WITHDRAWAL_LOGS, HASH(1), toBlock));
    const found = await discoverNativeWithdrawals({ l2, network: 'base', account: base.to, toBlock });
    expect(found).toEqual({ withdrawals: [{ txHash: HASH(1), blockNumber: toBlock }], complete: true });
    expect(l2.read).toHaveBeenCalledTimes(1);
    expect(l2.read.mock.calls[0][0]).toMatchObject({
      address: OP_STACK_DEPOSIT.base.l2TokenBridge,
      args: { localToken: OP_STACK_DEPOSIT.base.l2Usds },
      fromBlock: toBlock - window + 1n,
      toBlock,
      strict: true
    });
  });

  it("reads every withdrawal of Sky's Arbitrum gateway, whose token isn't indexed", async () => {
    const l2 = reader(async () => []);
    await discoverNativeWithdrawals({ l2, network: 'arbitrum', account: OTHER, toBlock: 1_000n });
    expect(l2.read).toHaveBeenCalledTimes(1);
    const [args] = l2.read.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(args).toMatchObject({ address: ARBITRUM_DEPOSIT.l2Gateway, fromBlock: 0n, toBlock: 1_000n });
    expect(args.args).toBeUndefined();
  });

  it("says the scan is incomplete when the window's logs can't be read", async () => {
    const l2 = reader(async () => {
      throw new Error('range too large');
    });
    const found = await discoverNativeWithdrawals({
      l2,
      network: 'optimism',
      account: optimism.from,
      toBlock: 1_000n
    });
    expect(found).toEqual({ withdrawals: [], complete: false });
  });
});
