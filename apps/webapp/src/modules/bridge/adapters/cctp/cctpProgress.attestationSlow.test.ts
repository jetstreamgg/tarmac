import { describe, expect, it, vi } from 'vitest';
import { TransactionReceiptNotFoundError, type Hex } from 'viem';
import { pendingBridgeNote } from '../../components/pendingBridgeRows';
import { applyProgress, canDismiss, createPendingBridge } from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import type { AdapterContext, ChainReader } from '../types';
import { cctpProgress } from './cctpProgress';
import { BASE_BURN_AMOUNT, BASE_BURN_ATTESTED, BASE_BURN_LOGS, BASE_BURN_TX } from './cctp.fixtures';
import type { AttestationReader, IrisAttestedMessage } from './iris';

// A mined CCTP burn past its ETA says what it waits for and that nothing is
// needed, whether Circle is slow or its API is down.

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const ATTESTED: IrisAttestedMessage = {
  message: BASE_BURN_ATTESTED.message,
  attestation: BASE_BURN_ATTESTED.attestation
};

const seed = (overrides: Partial<PendingBridge> = {}): PendingBridge & { from: 'base' } => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account: BASE_BURN_TX.from,
    amount: BASE_BURN_AMOUNT * 10n ** 12n,
    from: 'base',
    to: 'ethereum',
    route: result.route,
    txHash: BASE_BURN_TX.hash,
    now: NOW
  });
  return { ...bridge, ...overrides, from: 'base' };
};

type Iris = IrisAttestedMessage[] | 'down';

const chains = ({
  iris,
  mined = true,
  block = 26_000_000n
}: {
  iris: Iris;
  mined?: boolean;
  block?: bigint;
}) => {
  const l2 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (!mined) throw new TransactionReceiptNotFoundError({ hash });
      return { status: 'success', logs: BASE_BURN_LOGS };
    })
  };
  const l1 = {
    getBlockNumber: vi.fn(async () => block),
    readContract: vi.fn(async () => 0n)
  };
  const readAttestations = vi.fn<AttestationReader>(async () => {
    if (iris === 'down') throw new Error('Iris responded 503');
    return iris;
  });
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined) as unknown as ChainReader
  };
  return { context, readAttestations };
};

/** The card after one tracker poll at `now`. */
const afterPoll = async (bridge: PendingBridge, setup: ReturnType<typeof chains>, now = NOW + MINUTE) => {
  const progress = await cctpProgress(
    bridge as PendingBridge & { from: 'base' },
    setup.context,
    now,
    setup.readAttestations
  );
  return progress ? applyProgress(bridge, progress, now) : bridge;
};

describe('a mined CCTP burn Circle has not attested by its ETA', () => {
  it.each([
    ['is slow', [] as Iris],
    ['is down', 'down' as Iris]
  ])('says the attestation is late while Iris %s', async (_label, iris) => {
    const card = await afterPoll(seed(), chains({ iris }));

    expect(card.status).toBe('pending');
    expect(pendingBridgeNote(card, card.etaAt + MINUTE)).toEqual({ kind: 'attestation-slow' });
    // Late is not lost: the card stays, and the claim is still what comes next.
    expect(card.nextAction).toBe('claim');
    expect(canDismiss(card, card.etaAt + MINUTE)).toBe(false);
  });

  it('still says so on every later poll of an Iris outage', async () => {
    const setup = chains({ iris: 'down' });
    const first = await afterPoll(seed(), setup);
    const later = await afterPoll(first, setup, first.etaAt + 60 * MINUTE);

    expect(later.status).toBe('pending');
    expect(pendingBridgeNote(later, first.etaAt + 61 * MINUTE)).toEqual({ kind: 'attestation-slow' });
  });

  it('says nothing before the ETA', async () => {
    const card = await afterPoll(seed(), chains({ iris: [] }));
    expect(pendingBridgeNote(card, card.etaAt - MINUTE)).toBeUndefined();
  });

  it('never blames Circle for a burn no one read as mined', async () => {
    const card = await afterPoll(seed(), chains({ iris: 'down', mined: false }));
    expect(pendingBridgeNote(card, card.etaAt + MINUTE)).toBeUndefined();
  });

  it('says nothing once the claim is offered', async () => {
    const card = await afterPoll(seed(), chains({ iris: [ATTESTED] }));

    expect(card.status).toBe('ready');
    expect(pendingBridgeNote(card, card.etaAt + MINUTE)).toBeUndefined();
  });
});

describe('an Iris outage', () => {
  it('never takes back a claim already offered', async () => {
    const ready = await afterPoll(seed(), chains({ iris: [ATTESTED] }));
    const later = await afterPoll(ready, chains({ iris: 'down' }));

    expect(later.status).toBe('ready');
    expect(later.nextAction).toBe('claim');
    expect(later.routeData).toEqual(ready.routeData);
  });

  it('never takes back a ready claim whose stored copy expired', async () => {
    // The same copy, with expiration block 100.
    const offset = 2 + (148 + 196) * 2;
    const expired = {
      ...ATTESTED,
      message:
        `${ATTESTED.message.slice(0, offset)}${100n.toString(16).padStart(64, '0')}${ATTESTED.message.slice(offset + 64)}` as Hex
    };
    const ready = await afterPoll(seed(), chains({ iris: [expired], block: 99n }));
    expect(ready.status).toBe('ready');
    const later = await afterPoll(ready, chains({ iris: 'down', block: 100n }));

    expect(later.status).toBe('ready');
    expect(later.nextAction).toBe('claim');
    expect(later.routeData).toEqual(ready.routeData);
  });
});
