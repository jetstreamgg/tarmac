import { describe, expect, it, vi } from 'vitest';
import type { Log } from 'viem';
import { WITHDRAWAL_SCAN_BLOCKS } from '../nativeWithdrawal/discovery';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from './cctp.fixtures';
import { TOKEN_MESSENGER_V2, addressToBytes32, cctpL2Contracts } from './contracts';
import { burnsInLogs, discoverCctpBurns } from './discovery';

const BLOCK = 52_837_683n;
const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const mined = (hash = BASE_BURN_TX.hash, removed = false) =>
  BASE_BURN_LOGS.map(log => ({ ...log, transactionHash: hash, blockNumber: BLOCK, removed }) as Log);

describe('burnsInLogs', () => {
  it('reads the burn the account sent, once per transaction', () => {
    expect(burnsInLogs([...mined(), ...mined()], 'base', BASE_BURN_TX.from)).toEqual([
      {
        txHash: BASE_BURN_TX.hash,
        blockNumber: BLOCK,
        amount: BASE_BURN_AMOUNT,
        mintRecipient: addressToBytes32(BASE_BURN_TX.from),
        destinationDomain: 0
      }
    ]);
  });

  it('skips a burn another account sent', () => {
    expect(burnsInLogs(mined(), 'base', OTHER)).toEqual([]);
  });

  it("skips a burn of another network's USDC", () => {
    expect(burnsInLogs(mined(), 'optimism', BASE_BURN_TX.from)).toEqual([]);
  });

  it('skips a log a reorg removed', () => {
    expect(burnsInLogs(mined(BASE_BURN_TX.hash, true), 'base', BASE_BURN_TX.from)).toEqual([]);
  });

  it('skips the same event from any other contract', () => {
    const forged = mined().map(log => ({ ...log, address: OTHER }) as Log);
    expect(burnsInLogs(forged, 'base', BASE_BURN_TX.from)).toEqual([]);
  });
});

describe('discoverCctpBurns', () => {
  const TO_BLOCK = 53_000_000n;

  it("asks the TokenMessenger for the account's USDC burns over the network's window, in one query", async () => {
    const getLogs = vi.fn(async () => mined());
    const result = await discoverCctpBurns({
      l2: { getLogs: getLogs as never },
      network: 'base',
      account: BASE_BURN_TX.from,
      toBlock: TO_BLOCK
    });

    expect(result.complete).toBe(true);
    expect(result.burns.map(burn => burn.txHash)).toEqual([BASE_BURN_TX.hash]);
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs.mock.calls[0]).toMatchObject([
      {
        address: TOKEN_MESSENGER_V2,
        args: { burnToken: cctpL2Contracts('base').usdc, depositor: BASE_BURN_TX.from },
        fromBlock: TO_BLOCK - WITHDRAWAL_SCAN_BLOCKS.base + 1n,
        toBlock: TO_BLOCK,
        strict: true
      }
    ]);
  });

  // Base mines a block every 200 ms.
  it('finds a Base burn sent 20 days ago, in one query', async () => {
    const BLOCKS_PER_DAY = 432_000n;
    const toBlock = 100_000_000n;
    const sentAt = toBlock - 20n * BLOCKS_PER_DAY;
    const getLogs = vi.fn(async ({ fromBlock, toBlock: to }: { fromBlock: bigint; toBlock: bigint }) =>
      fromBlock <= sentAt && sentAt <= to ? mined().map(log => ({ ...log, blockNumber: sentAt })) : []
    );
    const result = await discoverCctpBurns({
      l2: { getLogs: getLogs as never },
      network: 'base',
      account: BASE_BURN_TX.from,
      toBlock
    });
    expect(result.complete).toBe(true);
    expect(result.burns.map(burn => burn.blockNumber)).toEqual([sentAt]);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it('starts at the first block of a chain shorter than the window', async () => {
    const getLogs = vi.fn(async () => []);
    await discoverCctpBurns({
      l2: { getLogs: getLogs as never },
      network: 'base',
      account: BASE_BURN_TX.from,
      toBlock: 10n
    });
    expect(getLogs.mock.calls[0]).toMatchObject([{ fromBlock: 0n, toBlock: 10n }]);
  });

  it('says so when the logs cannot be read, instead of reporting no burns', async () => {
    const getLogs = vi.fn(async () => {
      throw new Error('rate limited');
    });
    expect(
      await discoverCctpBurns({
        l2: { getLogs: getLogs as never },
        network: 'base',
        account: BASE_BURN_TX.from,
        toBlock: TO_BLOCK
      })
    ).toEqual({ burns: [], complete: false });
  });
});
