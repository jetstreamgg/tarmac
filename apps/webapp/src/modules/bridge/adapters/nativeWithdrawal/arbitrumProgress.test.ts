import { beforeEach, describe, expect, it } from 'vitest';
import {
  TransactionReceiptNotFoundError,
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  isAddressEqual,
  keccak256,
  zeroHash,
  type Hex
} from 'viem';
import type { PendingBridge } from '../../model/types';
import type { AdapterContext, ChainReader } from '../types';
import { ARB_SYS, ARBITRUM_CONFIRM_MS, arbSysAbi, arbitrumOutboxAbi } from './contracts';
import { arbitrumItemHash, arbitrumWithdrawalMessage } from './arbitrum';
import { arbitrumExecuteFromChain, arbitrumWithdrawalProgress } from './arbitrumProgress';
import { ARBITRUM_EXECUTE_TX, ARBITRUM_WITHDRAWAL_LOGS, ARBITRUM_WITHDRAWAL_TX } from './withdrawalFixtures';

const MESSAGE = arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!;
// The fixture withdrawal's ETA: the rollup may have confirmed it.
const NOW = Number(MESSAGE.timestamp) * 1000 + ARBITRUM_CONFIRM_MS;
const SEND_ROOT = keccak256('0x5e9d');
const L2_HASH = keccak256('0x12b1');

const realProof = () => {
  const { args } = decodeFunctionData({ abi: arbitrumOutboxAbi, data: ARBITRUM_EXECUTE_TX.input });
  return args![0] as readonly Hex[];
};

const state = {
  receiptStatus: 'success' as 'success' | 'reverted',
  spent: false,
  /** Leaves in the newest confirmed send root; undefined when no root was confirmed in range. */
  confirmedSize: undefined as bigint | undefined,
  rootKnown: true,
  proofRoot: SEND_ROOT as Hex,
  proofSend: undefined as Hex | undefined,
  logRanges: [] as bigint[],
  l1Receipts: {} as Record<string, 'success' | 'reverted'>,
  proofArgs: [] as unknown[]
};

beforeEach(() =>
  Object.assign(state, {
    receiptStatus: 'success',
    spent: false,
    confirmedSize: undefined,
    rootKnown: true,
    proofRoot: SEND_ROOT,
    proofSend: undefined,
    logRanges: [],
    l1Receipts: {},
    proofArgs: []
  })
);

const L1_HEAD = 24_000_000n;

const l1: ChainReader = {
  getTransactionReceipt: (async ({ hash }: { hash: Hex }) => {
    const status = state.l1Receipts[hash];
    if (!status) throw new TransactionReceiptNotFoundError({ hash });
    return { status } as never;
  }) as never,
  readContract: (async ({ functionName }: { functionName: string }) => {
    if (functionName === 'isSpent') return state.spent;
    if (functionName === 'roots') return state.rootKnown ? L2_HASH : zeroHash;
    throw new Error(`unexpected read ${functionName}`);
  }) as never,
  getBlockNumber: (async () => L1_HEAD) as never,
  getLogs: (async ({ fromBlock }: { fromBlock: bigint }) => {
    state.logRanges.push(L1_HEAD - fromBlock);
    return state.confirmedSize === undefined
      ? []
      : [{ args: { outputRoot: SEND_ROOT, l2BlockHash: L2_HASH }, blockNumber: L1_HEAD - 10n }];
  }) as never,
  getBlock: (async () => {
    throw new Error('no L1 blocks');
  }) as never,
  getTransaction: (async () => ({})) as never
};

const l2: ChainReader = {
  getTransactionReceipt: (async () => ({
    status: state.receiptStatus,
    logs: ARBITRUM_WITHDRAWAL_LOGS,
    blockNumber: ARBITRUM_WITHDRAWAL_TX.blockNumber
  })) as never,
  getBlock: (async ({ blockHash }: { blockHash?: Hex }) => {
    if (blockHash !== L2_HASH) throw new Error('unknown block');
    return { hash: L2_HASH, sendRoot: SEND_ROOT, sendCount: `0x${state.confirmedSize!.toString(16)}` };
  }) as never,
  readContract: (async ({ functionName, args }: { functionName: string; args: readonly unknown[] }) => {
    if (functionName !== 'constructOutboxProof') throw new Error(`unexpected read ${functionName}`);
    state.proofArgs.push(args);
    return [state.proofSend ?? arbitrumItemHash(MESSAGE), state.proofRoot, realProof()];
  }) as never,
  getTransaction: (async () => ({})) as never,
  getBlockNumber: (async () => 0n) as never,
  getLogs: (async () => []) as never
};

const context: AdapterContext = {
  getClient: network => (network === 'ethereum' ? l1 : network === 'arbitrum' ? l2 : undefined)
};

const bridge = (patch: Partial<Omit<PendingBridge, 'from'>> = {}): PendingBridge & { from: 'arbitrum' } => ({
  id: ARBITRUM_WITHDRAWAL_TX.hash,
  account: MESSAGE.from.toLowerCase(),
  recipient: MESSAGE.to,
  amount: MESSAGE.amount,
  token: 'USDS',
  from: 'arbitrum',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: true,
  nextAction: 'finalize',
  startedAt: NOW - 1000,
  etaAt: NOW + 1000,
  txHash: ARBITRUM_WITHDRAWAL_TX.hash,
  actions: [],
  ...patch
});

const progress = (patch?: Partial<Omit<PendingBridge, 'from'>>) =>
  arbitrumWithdrawalProgress(bridge(patch), context, NOW);

describe('arbitrumItemHash (golden: the real withdrawal)', () => {
  it('hashes the message as ArbSys did in its L2ToL1Tx', () => {
    const [sent] = ARBITRUM_WITHDRAWAL_LOGS.filter(log => isAddressEqual(log.address, ARB_SYS)).map(
      log => decodeEventLog({ abi: arbSysAbi, data: log.data, topics: log.topics }).args
    );
    expect(arbitrumItemHash(MESSAGE)).toBe(`0x${sent.hash.toString(16).padStart(64, '0')}`);
  });
});

describe('arbitrumWithdrawalProgress', () => {
  it('waits on the rollup until a confirmed send root holds the message, then offers the execute', async () => {
    const eta = Number(MESSAGE.timestamp) * 1000 + ARBITRUM_CONFIRM_MS;
    expect(await progress()).toEqual({ kind: 'waiting', etaAt: eta, nextAction: 'finalize' });
    state.confirmedSize = MESSAGE.position;
    expect(await progress()).toEqual({ kind: 'waiting', etaAt: eta, nextAction: 'finalize' });
    state.confirmedSize = MESSAGE.position + 1n;
    expect(await progress()).toEqual({ kind: 'ready', nextAction: 'finalize' });
  });

  it('reads no send root in the days the rollup cannot have confirmed the message yet', async () => {
    const sentAt = Number(MESSAGE.timestamp) * 1000;
    const eta = sentAt + ARBITRUM_CONFIRM_MS;
    state.confirmedSize = MESSAGE.position + 1n;
    const early = await arbitrumWithdrawalProgress(bridge(), context, eta - 25 * 60 * 60_000);
    expect(early).toEqual({ kind: 'waiting', etaAt: eta, nextAction: 'finalize' });
    expect(state.logRanges).toEqual([]);
    state.spent = true;
    expect(await arbitrumWithdrawalProgress(bridge(), context, sentAt + 60_000)).toEqual({ kind: 'arrived' });
    state.spent = false;
    expect(await arbitrumWithdrawalProgress(bridge(), context, eta - 23 * 60 * 60_000)).toEqual({
      kind: 'ready',
      nextAction: 'finalize'
    });
  });

  it('looks further back for a confirmed root before it waits', async () => {
    await progress();
    expect(state.logRanges.length).toBe(2);
    expect(state.logRanges[1]).toBeGreaterThan(state.logRanges[0]);
  });

  it('is arrived once the outbox spent the message, whoever executed it', async () => {
    state.spent = true;
    expect(await progress()).toEqual({ kind: 'arrived' });
  });

  it('fails a reverted source, and ignores a receipt whose withdrawal is not the recorded one', async () => {
    state.receiptStatus = 'reverted';
    expect(await progress()).toEqual({ kind: 'failed', reason: 'source-tx-reverted' });
    state.receiptStatus = 'success';
    expect(await progress({ amount: MESSAGE.amount + 1n })).toBeNull();
    expect(await progress({ recipient: '0x1111111111111111111111111111111111111111' })).toBeNull();
  });

  it('settles a sent execute by its Ethereum receipt first', async () => {
    state.l1Receipts['0xexec'] = 'success';
    expect(
      await progress({ actions: [{ action: 'finalize', txHash: '0xexec', at: NOW - 1000, status: 'sent' }] })
    ).toEqual({ kind: 'action-confirmed', action: 'finalize', txHash: '0xexec' });
  });
});

describe('arbitrumExecuteFromChain', () => {
  const execute = () => arbitrumExecuteFromChain({ l1, l2, bridge: bridge() });

  it('builds the real execute from the proof NodeInterface returns for the newest confirmed root', async () => {
    state.confirmedSize = MESSAGE.position + 10n;
    const call = await execute();
    expect(encodeFunctionData(call)).toBe(ARBITRUM_EXECUTE_TX.input);
    expect(state.proofArgs).toEqual([[MESSAGE.position + 10n, MESSAGE.position]]);
  });

  it("builds nothing before the rollup confirmed it, or when the proof isn't for the confirmed root and this message", async () => {
    await expect(execute()).rejects.toThrow();
    state.confirmedSize = MESSAGE.position + 10n;
    state.proofRoot = keccak256('0x01');
    await expect(execute()).rejects.toThrow();
    state.proofRoot = SEND_ROOT;
    state.proofSend = keccak256('0x02');
    await expect(execute()).rejects.toThrow();
    state.proofSend = undefined;
    state.rootKnown = false;
    await expect(execute()).rejects.toThrow();
  });
});
