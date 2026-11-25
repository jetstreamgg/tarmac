import { beforeEach, describe, expect, it } from 'vitest';
import { keccak256, pad, toHex, zeroHash, type Address } from 'viem';
import type { PendingBridge } from '../../model/types';
import type { AdapterContext, ChainReader } from '../types';
import { opStackWithdrawalMessage } from './opStack';
import { opStackWithdrawalProgress } from './opStackProgress';
import { outputRoot } from './opStackStatus';
import { BASE_WITHDRAWAL_LOGS, BASE_WITHDRAWAL_TX } from './withdrawalFixtures';

// A provider that stops serving storage proofs never costs the user the
// prove a served game allows, and never costs one request per game.

const NOW = 1_790_000_000_000;
const NOW_S = BigInt(NOW / 1000);
const DAY = 86_400n;
const MINUTE = 60_000;
const MESSAGE = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const FACTORY: Address = '0x00000000000000000000000000000000000fac70';
const REGISTRY: Address = '0x0000000000000000000000000000000000a5a5a5';
const STORAGE_HASH = keccak256('0x5107');
const WITHDRAWN = BASE_WITHDRAWAL_TX.blockNumber;
/** Two days of 2 s blocks after the withdrawal. */
const HEAD = { number: WITHDRAWN + 90_000n, timestamp: BASE_WITHDRAWAL_TX.timestamp + 180_000n };
const GAMES = 50;
/** Every game covers the withdrawal: the oldest an hour after it, then one an hour. */
const hourly = (i: number) => WITHDRAWN + 1000n + BigInt(i) * 1800n;

type Game = { l2Block: bigint; status: number; proper: boolean };

const state = {
  games: [] as Game[],
  /** Whether the provider serves the storage proof of an L2 block. */
  serves: (_block: bigint): boolean => true,
  /** Whether the L1 provider answers which L2 block a game is for. */
  readsGame: (_index: number): boolean => true,
  requests: 0,
  proofs: [] as bigint[]
};

const gameAddress = (i: number) => pad(`0x${(0x9a0000 + i).toString(16)}`, { size: 20 });
const gameAt = (address: string) => state.games[Number(BigInt(address) - 0x9a0000n)];

const l2Block = (number: bigint) => ({
  number,
  timestamp:
    number === WITHDRAWN ? BASE_WITHDRAWAL_TX.timestamp : HEAD.timestamp - (HEAD.number - number) * 2n,
  stateRoot: keccak256(toHex(number)),
  hash: keccak256(toHex(number + 1n))
});
const l2Root = (number: bigint) => {
  const block = l2Block(number);
  return outputRoot({
    version: zeroHash,
    stateRoot: block.stateRoot,
    messagePasserStorageRoot: STORAGE_HASH,
    latestBlockhash: block.hash
  });
};

const l1 = {
  readContract: async ({
    address,
    functionName,
    args
  }: {
    address: Address;
    functionName: string;
    args?: readonly unknown[];
  }) => {
    state.requests++;
    switch (functionName) {
      case 'successfulMessages':
      case 'failedMessages':
      case 'finalizedWithdrawals':
      case 'paused':
        return false;
      case 'disputeGameFactory':
        return FACTORY;
      case 'anchorStateRegistry':
        return REGISTRY;
      case 'proofMaturityDelaySeconds':
        return 7n * DAY;
      case 'disputeGameFinalityDelaySeconds':
        return 3n * DAY + DAY / 2n;
      case 'respectedGameType':
        return 621;
      case 'numProofSubmitters':
        return 0n;
      case 'gameCount':
        return BigInt(state.games.length);
      case 'findLatestGames':
        return state.games
          .map((game, i) => ({
            index: BigInt(i),
            metadata: pad(gameAddress(i), { size: 32 }),
            // A game for a block the L2 has not reached claims a root no one can check.
            rootClaim: game.l2Block > HEAD.number ? keccak256('0xfa57') : l2Root(game.l2Block)
          }))
          .reverse()
          .slice(0, Number((args as [number, bigint, bigint])[2]));
      case 'isGameProper':
        return gameAt(args![0] as string).proper;
      case 'l2SequenceNumber':
        if (!state.readsGame(Number(BigInt(address) - 0x9a0000n))) throw new Error('rate limited');
        return gameAt(address).l2Block;
      case 'status':
        return gameAt(address).status;
      case 'createdAt':
        return NOW_S - DAY;
      default:
        throw new Error(`unexpected read ${functionName}`);
    }
  }
} as unknown as ChainReader;

const l2 = {
  getTransactionReceipt: async () => {
    state.requests++;
    return { status: 'success', logs: BASE_WITHDRAWAL_LOGS, blockNumber: WITHDRAWN };
  },
  getBlock: async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
    state.requests++;
    const number = blockNumber ?? HEAD.number;
    if (number > HEAD.number) throw new Error('block not found');
    return l2Block(number);
  },
  getProof: async ({ blockNumber }: { blockNumber: bigint }) => {
    state.requests++;
    state.proofs.push(blockNumber);
    if (!state.serves(blockNumber)) throw new Error('no state found');
    return { storageHash: STORAGE_HASH };
  }
} as unknown as ChainReader;

const context: AdapterContext = {
  getClient: network => (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined)
};

const card: PendingBridge & { from: 'base' } = {
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
  actions: []
};

/** One tracker poll of the card. */
const poll = (now = NOW) => {
  state.requests = 0;
  state.proofs = [];
  return opStackWithdrawalProgress(card, context, now);
};

const proveAt = (i: number) => ({
  kind: 'ready',
  nextAction: 'prove',
  routeData: { gameIndex: i.toString(), l2BlockNumber: hourly(i).toString() }
});
/** A healthy poll makes 70 requests; one per game of a provider serving no proof made 364. */
const BOUNDED = 100;

beforeEach(() => {
  state.games = Array.from({ length: GAMES }, (_, i) => ({ l2Block: hourly(i), status: 0, proper: true }));
  state.serves = () => true;
  state.readsGame = () => true;
});

describe('an OP Stack withdrawal while the provider serves no storage proof', () => {
  beforeEach(() => {
    state.serves = () => false;
  });

  it('changes nothing on the card: nothing fails, nothing is offered, nothing offered is taken back', async () => {
    expect(await poll()).toBeNull();
  });

  it('asks for a handful of proofs per poll, not one per game', async () => {
    await poll();
    expect(state.proofs.length).toBeLessThanOrEqual(3);
    expect(state.requests).toBeLessThan(BOUNDED);
  });

  it('is offered its prove on the first poll after the provider recovers', async () => {
    await poll();
    state.serves = () => true;
    expect(await poll()).toEqual(proveAt(0));
  });
});

describe('an OP Stack withdrawal while the provider serves proofs only up to a block (2026-11-05)', () => {
  it('is offered its prove against the oldest game, when that one is served', async () => {
    state.serves = block => block <= hourly(10);
    expect(await poll()).toEqual(proveAt(0));
    expect(state.proofs).toEqual([hourly(0)]);
  });

  it('changes nothing, at a bounded cost, when every game covering it is past that block', async () => {
    state.serves = block => block < hourly(0);
    expect(await poll()).toBeNull();
    expect(state.proofs.length).toBeLessThanOrEqual(3);
    expect(state.requests).toBeLessThan(BOUNDED);
  });
});

describe('an OP Stack withdrawal while the provider serves only recent proofs (2026-11-04)', () => {
  it('is still offered its prove, against a game the provider serves, at a bounded cost', async () => {
    state.serves = block => block >= hourly(GAMES - 1);
    expect(await poll()).toEqual(proveAt(GAMES - 1));
    expect(state.requests).toBeLessThan(BOUNDED);
  });

  it('is offered its prove within the hour when only a few games in the middle are served', async () => {
    state.serves = block => block >= hourly(3) && block <= hourly(10);
    let polls = 0;
    let result = await poll();
    // The tracker polls a card waiting for its prove every minute.
    while (result === null && polls < 60) {
      expect(state.requests).toBeLessThan(BOUNDED);
      polls += 1;
      result = await poll(NOW + polls * MINUTE);
    }
    expect(result).toMatchObject({ kind: 'ready', nextAction: 'prove' });
    expect(state.requests).toBeLessThan(BOUNDED);
  });

  it('is never told to wait again once offered, while those games are served', async () => {
    state.serves = block => block >= hourly(3) && block <= hourly(10);
    const results = [];
    for (let polls = 0; polls < 120; polls++) results.push(await poll(NOW + polls * MINUTE));
    const offered = results.filter(result => result !== null);
    expect(offered.length).toBeGreaterThan(0);
    // Null leaves the card as it is; a wait would take the offered prove back.
    for (const result of offered) expect(result).toMatchObject({ kind: 'ready', nextAction: 'prove' });
  });

  it.each([MINUTE, 5 * MINUTE, 61_000])(
    'finds a served game whatever the %i ms between polls',
    async every => {
      state.serves = block => block === hourly(7);
      let result = null;
      for (let polls = 0; polls < 600 && result === null; polls++) result = await poll(NOW + polls * every);
      expect(result).toEqual(proveAt(7));
    }
  );
});

describe('an OP Stack withdrawal while the block of a game cannot be read', () => {
  it('changes nothing on the card when no game tells its block', async () => {
    state.readsGame = () => false;
    expect(await poll()).toBeNull();
  });

  it('changes nothing when the games that tell their block are all from before it', async () => {
    state.games = state.games.map((game, i) =>
      i < 5 ? { ...game, l2Block: WITHDRAWN - 100n + BigInt(i) } : game
    );
    state.readsGame = i => i < 5;
    expect(await poll()).toBeNull();
  });

  it('is still offered its prove against a game that tells its block', async () => {
    state.readsGame = i => i !== 0;
    expect(await poll()).toEqual(proveAt(1));
  });
});

describe('games a prove cannot use, with a healthy provider', () => {
  it('never cost the prove, however many are lost, improper or for a block the L2 has not reached', async () => {
    const unreached = (length: number) =>
      Array.from({ length }, (_, i) => ({
        l2Block: HEAD.number + 1000n + BigInt(i),
        status: 0,
        proper: true
      }));
    state.games = [
      ...Array.from({ length: 5 }, (_, i) => ({ l2Block: hourly(i), status: 1, proper: true })),
      ...Array.from({ length: 5 }, (_, i) => ({ l2Block: hourly(5 + i), status: 0, proper: false })),
      ...unreached(5),
      { l2Block: hourly(15), status: 0, proper: true },
      ...unreached(2)
    ];
    expect(await poll()).toEqual({
      kind: 'ready',
      nextAction: 'prove',
      routeData: { gameIndex: '15', l2BlockNumber: hourly(15).toString() }
    });
  });
});
