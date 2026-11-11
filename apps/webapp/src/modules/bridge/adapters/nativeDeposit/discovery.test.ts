import { describe, expect, it, vi } from 'vitest';
import { isAddressEqual, type Hex, type Log } from 'viem';
import {
  ARBITRUM_DEPOSIT_LOGS,
  ARBITRUM_DEPOSIT_TX,
  BASE_DEPOSIT_LOGS,
  BASE_DEPOSIT_TX,
  OPTIMISM_DEPOSIT_LOGS,
  OPTIMISM_DEPOSIT_TX,
  UNICHAIN_DEPOSIT_LOGS,
  UNICHAIN_DEPOSIT_TX
} from './depositFixtures';
import { ARBITRUM_DEPOSIT, L1_USDS, OP_STACK_DEPOSIT } from './contracts';
import {
  DISCOVERY_CHUNK_BLOCKS,
  DISCOVERY_WINDOW_BLOCKS,
  depositsInLogs,
  discoverNativeDeposits
} from './discovery';

const HASH = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const mined = (logs: Log[], txHash: Hex, blockNumber = 100n) =>
  logs.map(log => ({ ...log, transactionHash: txHash, blockNumber, removed: false }) as Log);

const SUSDS = 'a3931d71877c0e7a3148cb7eb4463524fec27fbd';
// The fixture's gateway deposit moved sUSDS; the same log with USDS as its token.
const ARBITRUM_USDS_LOGS = ARBITRUM_DEPOSIT_LOGS.map(log => ({
  ...log,
  data: log.data.replace(SUSDS, L1_USDS.slice(2).toLowerCase()) as Hex
}));

describe('depositsInLogs', () => {
  it('reads each OP Stack deposit with its network, amount and recipient', () => {
    const cases = [
      ['base', BASE_DEPOSIT_LOGS, BASE_DEPOSIT_TX.from],
      ['optimism', OPTIMISM_DEPOSIT_LOGS, OPTIMISM_DEPOSIT_TX.from],
      ['unichain', UNICHAIN_DEPOSIT_LOGS, UNICHAIN_DEPOSIT_TX.from]
    ] as const;
    for (const [network, logs, from] of cases) {
      const [deposit, ...rest] = depositsInLogs(mined(logs, HASH(1)), from);
      expect(rest).toEqual([]);
      expect(deposit).toMatchObject({ txHash: HASH(1), blockNumber: 100n, to: network });
      expect(deposit.amount).toBeGreaterThan(0n);
    }
    const [base] = depositsInLogs(mined(BASE_DEPOSIT_LOGS, HASH(1)), BASE_DEPOSIT_TX.from);
    expect(base.amount).toBe(0x43ba8fa7070da980000n);
    expect(base.recipient.toLowerCase()).toBe(BASE_DEPOSIT_TX.from);
  });

  it('reads an Arbitrum gateway deposit of USDS', () => {
    expect(depositsInLogs(mined(ARBITRUM_USDS_LOGS, HASH(2)), ARBITRUM_DEPOSIT_TX.from)).toEqual([
      {
        txHash: HASH(2),
        blockNumber: 100n,
        to: 'arbitrum',
        amount: 10n ** 18n,
        recipient: expect.stringMatching(new RegExp(ARBITRUM_DEPOSIT_TX.from, 'i'))
      }
    ]);
  });

  it('ignores another token through the same gateway (the fixture moved sUSDS)', () => {
    expect(depositsInLogs(mined(ARBITRUM_DEPOSIT_LOGS, HASH(2)), ARBITRUM_DEPOSIT_TX.from)).toEqual([]);
  });

  it('ignores a deposit sent by another account', () => {
    expect(depositsInLogs(mined(BASE_DEPOSIT_LOGS, HASH(1)), ARBITRUM_DEPOSIT_TX.from)).toEqual([]);
    expect(depositsInLogs(mined(ARBITRUM_USDS_LOGS, HASH(2)), BASE_DEPOSIT_TX.from)).toEqual([]);
  });

  it('ignores the same event from a contract that is not a Sky bridge', () => {
    const forged = mined(BASE_DEPOSIT_LOGS, HASH(1)).map(log => ({
      ...log,
      address: ARBITRUM_DEPOSIT.inbox
    }));
    expect(depositsInLogs(forged as Log[], BASE_DEPOSIT_TX.from)).toEqual([]);
  });

  it('ignores removed and pending logs', () => {
    const logs = mined(BASE_DEPOSIT_LOGS, HASH(1));
    expect(
      depositsInLogs(
        logs.map(log => ({ ...log, removed: true })),
        BASE_DEPOSIT_TX.from
      )
    ).toEqual([]);
    expect(
      depositsInLogs(
        logs.map(log => ({ ...log, transactionHash: null }) as Log),
        BASE_DEPOSIT_TX.from
      )
    ).toEqual([]);
    expect(
      depositsInLogs(
        logs.map(log => ({ ...log, blockNumber: null }) as Log),
        BASE_DEPOSIT_TX.from
      )
    ).toEqual([]);
  });

  it('keeps one deposit per transaction', () => {
    const logs = mined(BASE_DEPOSIT_LOGS, HASH(1));
    expect(depositsInLogs([...logs, ...logs], BASE_DEPOSIT_TX.from)).toHaveLength(1);
  });
});

type LogQuery = { fromBlock: bigint; toBlock: bigint; address: unknown; args: object };

describe('discoverNativeDeposits', () => {
  const ACCOUNT = BASE_DEPOSIT_TX.from;
  const TO_BLOCK = 24_000_000n;
  const scan = (toBlock: bigint, read: (query: LogQuery) => Promise<Log[]> = async () => []) => {
    const getLogs = vi.fn(read);
    const result = discoverNativeDeposits({ l1: { getLogs: getLogs as never }, account: ACCOUNT, toBlock });
    return { result, queries: () => getLogs.mock.calls.map(([query]) => query) };
  };

  it('scans the window newest range first, the bridges and the gateway in each', async () => {
    const { result, queries } = scan(TO_BLOCK);
    expect(await result).toEqual({ deposits: [], complete: true });

    const ranges = queries();
    const chunks = Number((DISCOVERY_WINDOW_BLOCKS + DISCOVERY_CHUNK_BLOCKS) / DISCOVERY_CHUNK_BLOCKS);
    expect(ranges).toHaveLength(chunks * 2);
    expect(ranges[0]).toMatchObject({ fromBlock: TO_BLOCK - DISCOVERY_CHUNK_BLOCKS + 1n, toBlock: TO_BLOCK });
    expect(ranges.at(-1)).toMatchObject({ fromBlock: TO_BLOCK - DISCOVERY_WINDOW_BLOCKS });
    // Contiguous, no block twice.
    for (let i = 2; i < ranges.length; i += 2) expect(ranges[i].toBlock).toBe(ranges[i - 2].fromBlock - 1n);
  });

  it('filters on the account and USDS', async () => {
    const { result, queries } = scan(TO_BLOCK);
    await result;
    const [bridges, gateway] = queries();
    expect(bridges.args).toEqual({ localToken: L1_USDS, from: ACCOUNT });
    expect(bridges.address).toHaveLength(3);
    expect(gateway).toMatchObject({ address: ARBITRUM_DEPOSIT.l1Gateway, args: { _from: ACCOUNT } });
  });

  it('stops at block 0 on a young chain', async () => {
    const { result, queries } = scan(15_000n);
    await result;
    expect(queries().map(range => [range.fromBlock, range.toBlock])).toEqual([
      [5_001n, 15_000n],
      [5_001n, 15_000n],
      [0n, 5_000n],
      [0n, 5_000n]
    ]);
  });

  it('skips a range it cannot read, keeps the others and reports incomplete', async () => {
    const found = mined(BASE_DEPOSIT_LOGS, HASH(1), TO_BLOCK - 3n).filter(log =>
      isAddressEqual(log.address, OP_STACK_DEPOSIT.base.l1TokenBridge)
    );
    const { result } = scan(TO_BLOCK, async ({ fromBlock, address }) => {
      if (fromBlock === TO_BLOCK - 2n * DISCOVERY_CHUNK_BLOCKS + 1n) throw new Error('limit exceeded');
      return Array.isArray(address) && fromBlock > TO_BLOCK - DISCOVERY_CHUNK_BLOCKS ? found : [];
    });
    const { complete, deposits } = await result;
    expect(complete).toBe(false);
    expect(deposits).toMatchObject([{ txHash: HASH(1), to: 'base', blockNumber: TO_BLOCK - 3n }]);
  });
});
