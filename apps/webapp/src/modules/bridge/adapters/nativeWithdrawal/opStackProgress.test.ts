import { beforeEach, describe, expect, it } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  TransactionReceiptNotFoundError,
  encodeErrorResult,
  pad,
  type Address,
  type Hex
} from 'viem';
import type { PendingBridge } from '../../model/types';
import { OP_STACK_DEPOSIT } from '../nativeDeposit/contracts';
import type { AdapterContext, ChainReader } from '../types';
import { OP_STACK_WITHDRAWAL, optimismPortalAbi } from './contracts';
import { opStackWithdrawalMessage } from './opStack';
import { opStackWithdrawalProgress } from './opStackProgress';
import { PROOF_WINDOW_SECONDS } from './opStackStatus';
import { BASE_WITHDRAWAL_LOGS, BASE_WITHDRAWAL_TX } from './withdrawalFixtures';

const NOW = 1_790_000_000_000;
const NOW_S = BigInt(NOW / 1000);
const DAY = 86_400n;
const MESSAGE = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const PORTAL = OP_STACK_DEPOSIT.base.portal;
const FACTORY: Address = '0x00000000000000000000000000000000000fac70';
const REGISTRY: Address = '0x0000000000000000000000000000000000a5a5a5';
const PROVER: Address = '0x00000000000000000000000000000000000b0b00';
const OTHER_PROVER: Address = '0x00000000000000000000000000000000000c0c00';
const gameAddress = (i: number) => pad(`0x${(0x9a0000 + i).toString(16)}`, { size: 20 });

type Game = {
  status: number;
  createdAt: bigint;
  resolvedAt: bigint;
  expectedResolution: bigint;
  maxClockDuration: bigint;
  l2SequenceNumber: bigint;
  proper: boolean;
};

const state = {
  receiptStatus: 'success' as 'success' | 'reverted',
  logs: BASE_WITHDRAWAL_LOGS,
  successful: false,
  failed: false,
  finalized: false,
  respectedGameType: 621,
  portalPaused: false,
  registryPaused: false,
  provers: [] as Address[],
  check: {} as Record<string, string | undefined | Error>,
  proven: {} as Record<string, { game: Address; timestamp: bigint }>,
  games: [] as Game[],
  l2Head: { number: 0n, timestamp: 0n },
  l2BlockTime: 2n,
  l1Receipts: {} as Record<string, 'success' | 'reverted'>
};

const revert = (errorName: string) =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({
      abi: optimismPortalAbi,
      data: encodeErrorResult({ abi: optimismPortalAbi, errorName: errorName as never }),
      functionName: 'checkWithdrawal'
    }),
    { abi: optimismPortalAbi, functionName: 'checkWithdrawal', args: [], contractAddress: PORTAL }
  );

const gameIndex = (address: string) =>
  state.games.findIndex((_, i) => gameAddress(i) === address.toLowerCase());

const l1: ChainReader = {
  getTransactionReceipt: async ({ hash }: { hash: Hex }) => {
    const status = state.l1Receipts[hash];
    if (!status) throw new TransactionReceiptNotFoundError({ hash });
    return { status } as never;
  },
  readContract: (async ({
    address,
    functionName,
    args
  }: {
    address: Address;
    functionName: string;
    args?: readonly unknown[];
  }) => {
    switch (functionName) {
      case 'successfulMessages':
        return state.successful;
      case 'failedMessages':
        return state.failed;
      case 'disputeGameFactory':
        return FACTORY;
      case 'anchorStateRegistry':
        return REGISTRY;
      case 'proofMaturityDelaySeconds':
        return 7n * DAY;
      case 'disputeGameFinalityDelaySeconds':
        return 3n * DAY + DAY / 2n;
      case 'respectedGameType':
        return state.respectedGameType;
      case 'paused':
        return address === PORTAL ? state.portalPaused : state.registryPaused;
      case 'finalizedWithdrawals':
        return state.finalized;
      case 'numProofSubmitters':
        return BigInt(state.provers.length);
      case 'proofSubmitters':
        return state.provers[Number(args![1])];
      case 'checkWithdrawal': {
        const result = state.check[args![1] as string];
        if (result instanceof Error) throw result;
        if (result) throw revert(result);
        return undefined;
      }
      case 'provenWithdrawals': {
        const { game, timestamp } = state.proven[args![1] as string];
        return [game, timestamp];
      }
      case 'isGameProper':
        return state.games[gameIndex(args![0] as string)].proper;
      case 'gameCount':
        return BigInt(state.games.length);
      case 'findLatestGames': {
        const [, start, n] = args as [number, bigint, bigint];
        return state.games
          .map((_, i) => ({ index: BigInt(i), metadata: pad(gameAddress(i), { size: 32 }) }))
          .filter(game => game.index <= start)
          .reverse()
          .slice(0, Number(n));
      }
      default: {
        const game = state.games[gameIndex(address)];
        if (!game) throw new Error(`unexpected read ${functionName}`);
        return game[functionName as keyof Game];
      }
    }
  }) as never,
  getBlock: (async () => {
    throw new Error('no L1 blocks');
  }) as never,
  getTransaction: (async () => ({})) as never,
  getBlockNumber: (async () => 0n) as never,
  getLogs: (async () => []) as never
};

const l2: ChainReader = {
  ...l1,
  getTransactionReceipt: (async () => ({
    status: state.receiptStatus,
    logs: state.logs,
    blockNumber: BASE_WITHDRAWAL_TX.blockNumber
  })) as never,
  getBlock: (async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
    const { number, timestamp } = state.l2Head;
    if (blockNumber === undefined) return { number, timestamp };
    if (blockNumber === BASE_WITHDRAWAL_TX.blockNumber)
      return { number: blockNumber, timestamp: BASE_WITHDRAWAL_TX.timestamp };
    return { number: blockNumber, timestamp: timestamp - (number - blockNumber) * state.l2BlockTime };
  }) as never
};

const context: AdapterContext = {
  getClient: network => (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined)
};

const bridge = (patch: Partial<Omit<PendingBridge, 'from'>> = {}): PendingBridge & { from: 'base' } => ({
  id: BASE_WITHDRAWAL_TX.hash,
  account: MESSAGE.from.toLowerCase(),
  recipient: MESSAGE.to,
  amount: MESSAGE.amount,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: true,
  nextAction: 'prove',
  startedAt: NOW - 1000,
  etaAt: NOW + 1000,
  txHash: BASE_WITHDRAWAL_TX.hash,
  actions: [],
  ...patch
});

const progress = (patch?: Partial<Omit<PendingBridge, 'from'>>) =>
  opStackWithdrawalProgress(bridge(patch), context, NOW);

const game = (patch: Partial<Game> = {}): Game => ({
  status: 0,
  createdAt: NOW_S - DAY,
  resolvedAt: 0n,
  expectedResolution: NOW_S + DAY,
  maxClockDuration: 3n * DAY + DAY / 2n,
  l2SequenceNumber: BASE_WITHDRAWAL_TX.blockNumber + 100n,
  proper: true,
  ...patch
});

const prove = { action: 'prove' as const, txHash: '0xprove', at: NOW - 1000 };

beforeEach(() => {
  Object.assign(state, {
    receiptStatus: 'success',
    logs: BASE_WITHDRAWAL_LOGS,
    successful: false,
    failed: false,
    finalized: false,
    respectedGameType: 621,
    portalPaused: false,
    registryPaused: false,
    provers: [],
    check: {},
    proven: {},
    games: [],
    l2Head: {
      number: BASE_WITHDRAWAL_TX.blockNumber + 1000n,
      timestamp: BASE_WITHDRAWAL_TX.timestamp + 2000n
    },
    l2BlockTime: 2n,
    l1Receipts: {}
  });
});

describe('opStackWithdrawalProgress: delivery', () => {
  it('is arrived once the L1 messenger relayed the message, whoever finalized it', async () => {
    state.successful = true;
    expect(await progress()).toEqual({ kind: 'arrived' });
  });

  it('offers the retry on Ethereum when the withdrawal finalized but the relay failed', async () => {
    Object.assign(state, { finalized: true, failed: true });
    expect(await progress()).toEqual({
      kind: 'ready',
      nextAction: 'replay',
      routeData: { msgHash: MESSAGE.msgHash, relayCalldata: MESSAGE.withdrawal.data }
    });
  });

  it('fails a reverted source, and ignores a receipt whose withdrawal is not the recorded one', async () => {
    state.receiptStatus = 'reverted';
    expect(await progress()).toEqual({ kind: 'failed', reason: 'source-tx-reverted' });
    state.receiptStatus = 'success';
    expect(await progress({ amount: MESSAGE.amount + 1n })).toBeNull();
    expect(await progress({ recipient: OTHER_PROVER })).toBeNull();
  });
});

describe('opStackWithdrawalProgress: proofs', () => {
  beforeEach(() => {
    state.games = [game()];
    state.provers = [PROVER];
    state.proven[PROVER] = { game: gameAddress(0), timestamp: NOW_S - DAY };
  });

  it('offers the finalize with the prover whose proof checkWithdrawal passes', async () => {
    state.provers = [OTHER_PROVER, PROVER];
    state.proven[OTHER_PROVER] = { game: gameAddress(0), timestamp: NOW_S - DAY };
    state.check = { [OTHER_PROVER]: 'OptimismPortal_ProofNotOldEnough', [PROVER]: undefined };
    expect(await progress({ actions: [prove] })).toEqual({
      kind: 'ready',
      nextAction: 'finalize',
      routeData: { prover: PROVER }
    });
  });

  it("waits for the proof's maturity or its game's finality, whichever is later", async () => {
    state.check = { [PROVER]: 'OptimismPortal_ProofNotOldEnough' };
    // Proven a day ago: matures in 6 days; the game resolves in 1 day and is final 3.5 days later.
    expect(await progress({ actions: [prove] })).toEqual({
      kind: 'waiting',
      etaAt: Number(NOW_S - DAY + 7n * DAY + 1n) * 1000,
      nextAction: 'finalize',
      routeData: { prover: PROVER }
    });
    state.games = [game({ resolvedAt: NOW_S + 10n * DAY })];
    state.check = { [PROVER]: 'OptimismPortal_InvalidRootClaim' };
    expect(await progress({ actions: [prove] })).toMatchObject({
      etaAt: Number(NOW_S + 10n * DAY + 3n * DAY + DAY / 2n + 1n) * 1000
    });
  });

  it('reads a super root game as resolving when its clock runs out', async () => {
    state.respectedGameType = 4;
    state.games = [game({ createdAt: NOW_S, maxClockDuration: 10n * DAY })];
    state.check = { [PROVER]: 'OptimismPortal_ProofNotOldEnough' };
    expect(await progress({ actions: [prove] })).toMatchObject({
      etaAt: Number(NOW_S + 10n * DAY + 3n * DAY + DAY / 2n + 1n) * 1000
    });
  });

  it('invalidates a confirmed prove whose game lost or was blacklisted', async () => {
    state.check = { [PROVER]: 'OptimismPortal_InvalidRootClaim' };
    state.games = [game({ status: 1 })];
    expect(await progress({ actions: [prove] })).toEqual({ kind: 'action-invalidated', action: 'prove' });
    state.games = [game({ proper: false })];
    expect(await progress({ actions: [prove] })).toEqual({ kind: 'action-invalidated', action: 'prove' });
  });

  it('never reads a pause as an invalid game', async () => {
    state.check = { [PROVER]: 'OptimismPortal_InvalidRootClaim' };
    state.games = [game({ proper: false })];
    state.registryPaused = true;
    expect(await progress({ actions: [prove] })).toMatchObject({ kind: 'waiting', nextAction: 'finalize' });
    state.registryPaused = false;
    state.portalPaused = true;
    expect(await progress({ actions: [prove] })).toMatchObject({ kind: 'waiting', nextAction: 'finalize' });
  });

  it('never invalidates a confirmed prove the chain shows no proof for yet: the read lags', async () => {
    state.provers = [];
    expect(await progress({ actions: [prove] })).toBeNull();
  });

  it('changes nothing when a read fails', async () => {
    state.check = { [PROVER]: new Error('rpc down') };
    expect(await progress({ actions: [prove] })).toBeNull();
  });
});

describe('opStackWithdrawalProgress: prove', () => {
  it('offers the prove against the oldest covering game, once one is posted', async () => {
    const block = BASE_WITHDRAWAL_TX.blockNumber;
    // Oldest to newest: two before the withdrawal, then four that cover it.
    state.games = [-20n, -1n, 0n, 50n, 60n, 70n].map(offset => game({ l2SequenceNumber: block + offset }));
    expect(await progress()).toEqual({
      kind: 'ready',
      nextAction: 'prove',
      routeData: { gameIndex: '2', l2BlockNumber: block.toString() }
    });
  });

  it('skips a lost, improper or not yet created game, and one too old for its state to be served', async () => {
    const block = BASE_WITHDRAWAL_TX.blockNumber;
    state.games = [
      game({ l2SequenceNumber: block, status: 1 }),
      game({ l2SequenceNumber: block + 1n, proper: false }),
      game({ l2SequenceNumber: block + 2n, createdAt: NOW_S + 1n }),
      game({ l2SequenceNumber: block + 3n })
    ];
    expect(await progress()).toMatchObject({ routeData: { gameIndex: '3' } });
    // Days later, past the window the proxy serves.
    const blocksLater = PROOF_WINDOW_SECONDS / 2n + 1000n;
    state.l2Head = {
      number: block + blocksLater,
      timestamp: BASE_WITHDRAWAL_TX.timestamp + 2n * blocksLater
    };
    expect(await progress()).toEqual({ kind: 'waiting', nextAction: 'prove' });
  });

  it('proves a super root game at the L2 block of its timestamp', async () => {
    state.respectedGameType = 4;
    const head = state.l2Head;
    state.games = [game({ l2SequenceNumber: head.timestamp - 200n })];
    expect(await progress()).toEqual({
      kind: 'ready',
      nextAction: 'prove',
      routeData: { gameIndex: '0', l2BlockNumber: (head.number - 100n).toString() }
    });
  });

  it('waits while no game covers the withdrawal, and when every other proof is invalid offers a prove', async () => {
    state.games = [game({ l2SequenceNumber: BASE_WITHDRAWAL_TX.blockNumber - 1n })];
    expect(await progress()).toEqual({ kind: 'waiting', nextAction: 'prove' });
    state.games.push(game());
    state.provers = [OTHER_PROVER];
    state.proven[OTHER_PROVER] = { game: gameAddress(0), timestamp: NOW_S - DAY };
    state.check = { [OTHER_PROVER]: 'OptimismPortal_InvalidProofTimestamp' };
    expect(await progress()).toMatchObject({
      kind: 'ready',
      nextAction: 'prove',
      routeData: { gameIndex: '1' }
    });
  });
});

describe('opStackWithdrawalProgress: sent actions', () => {
  it('settles a sent finalize by its Ethereum receipt before reading anything else', async () => {
    state.l1Receipts['0xfin'] = 'success';
    expect(
      await progress({
        actions: [prove, { action: 'finalize', txHash: '0xfin', at: NOW - 1000, status: 'sent' }]
      })
    ).toEqual({ kind: 'action-confirmed', action: 'finalize', txHash: '0xfin' });
  });

  it('leaves a sent action of a Safe to the tracker', async () => {
    state.successful = true;
    expect(
      await progress({
        actions: [{ action: 'prove', txHash: '0xsafe', at: NOW - 1000, status: 'sent', safe: true }]
      })
    ).toEqual({ kind: 'arrived' });
  });
});

it('targets the messenger and portal of the network it reads', () => {
  expect(OP_STACK_WITHDRAWAL.base.l1Messenger).not.toBe(OP_STACK_WITHDRAWAL.optimism.l1Messenger);
});
