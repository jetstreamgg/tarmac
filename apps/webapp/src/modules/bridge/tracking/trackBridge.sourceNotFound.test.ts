import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import { formatAddress } from '@/utils';
import type { BridgeAdapter } from '../adapters/types';
import { buildBridgeActivity } from '../components/bridgeActivity';
import { bridgeTxHref, buildPendingBridgeRows } from '../components/pendingBridgeRows';
import { getBridgeNetwork } from '../model/networks';
import { canDismiss, isTracked, pollIntervalMs } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import { isSwapSpendable, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { pollAt, sourceChain, type SourceState } from './sourceNotFound.fixtures';

// A source transaction the chain has no record of (dropped or replaced by the
// wallet) must not hold its card, or the USDC of the swap behind it, forever.
// It is never called failed: the card says so, can be dismissed, and comes back
// if the hash shows up.

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const HASH = `0x${'c4'.repeat(32)}`;

type Route = Pick<PendingBridge, 'from' | 'to' | 'routeKind' | 'requiresClaim' | 'nextAction'> & {
  name: string;
  /** How long the source chain may not know the hash before the card says so. */
  wait: number;
};

const ROUTES: Route[] = [
  {
    name: 'a CCTP bridge from Base',
    from: 'base',
    to: 'ethereum',
    routeKind: 'cctp',
    requiresClaim: true,
    nextAction: 'claim',
    wait: 15 * MINUTE
  },
  {
    name: 'a deposit to Base',
    from: 'ethereum',
    to: 'base',
    routeKind: 'native',
    requiresClaim: false,
    wait: 3 * HOUR
  },
  {
    name: 'a deposit to Arbitrum',
    from: 'ethereum',
    to: 'arbitrum',
    routeKind: 'native',
    requiresClaim: false,
    wait: 3 * HOUR
  },
  {
    name: 'a withdrawal from Base',
    from: 'base',
    to: 'ethereum',
    routeKind: 'native',
    requiresClaim: true,
    nextAction: 'prove',
    wait: 15 * MINUTE
  },
  {
    name: 'a withdrawal from Arbitrum',
    from: 'arbitrum',
    to: 'ethereum',
    routeKind: 'native',
    requiresClaim: true,
    nextAction: 'finalize',
    wait: 15 * MINUTE
  }
];

const seed = ({ name: _name, wait: _wait, ...route }: Route, patch: Partial<PendingBridge> = {}) =>
  ({
    id: HASH,
    account: ACCOUNT,
    amount: 10n ** 18n,
    token: 'USDS',
    status: 'pending',
    startedAt: NOW,
    etaAt: NOW + 20 * MINUTE,
    txHash: HASH,
    actions: [],
    ...route,
    ...patch
  }) satisfies PendingBridge;

const cell = (bridge: PendingBridge, now: number, label: string) => {
  const found = buildPendingBridgeRows(bridge, now, 1)
    .flat()
    .find(entry => entry.label === label);
  if (!found || !('value' in found)) throw new Error(`No ${label} cell`);
  return found;
};

const waiting: BridgeAdapter = { checkProgress: async () => ({ kind: 'waiting' }) };
const silent: BridgeAdapter = { checkProgress: async () => null };

describe.each(ROUTES)('$name whose source transaction the chain has no record of', route => {
  let store = createPendingBridgeStore({ now: () => NOW });
  let source = sourceChain(route.from);
  const sourceName = getBridgeNetwork(route.from).name;
  const stored = () => store.getSnapshot(SCOPE).find(entry => entry.id === HASH)!;
  const poll = (now: number, state: SourceState = 'unknown', adapter?: BridgeAdapter) => {
    source.chain.state = state;
    return pollAt({ store, scope: SCOPE, id: HASH, now, context: source.context, adapter });
  };
  const hasBridgeRow = () => buildBridgeActivity([stored()]).some(entry => entry.kind === 'bridge');
  const expectFollowed = (now: number) => {
    expect(stored().status).toBe('pending');
    expect(canDismiss(stored(), now)).toBe(false);
    expect(cell(stored(), now, 'Transaction').value).toBe(formatAddress(HASH, 6, 4));
    expect(hasBridgeRow()).toBe(true);
  };
  const expectNotFound = (now: number) => {
    // Never terminal: no evidence it failed.
    expect(stored().status).toBe('pending');
    expect(isTracked(stored())).toBe(true);
    expect(canDismiss(stored(), now)).toBe(true);
    expect(cell(stored(), now, 'Transaction')).toMatchObject({
      value: `Not found on ${sourceName}`,
      href: bridgeTxHref(route.from, HASH, 1)
    });
    expect(cell(stored(), now, 'Estimated arrival').value).toBe(NO_VALUE);
    expect(hasBridgeRow()).toBe(false);
  };

  beforeEach(() => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => NOW });
    source = sourceChain(route.from);
    store.upsert(SCOPE, seed(route));
  });

  it('is followed as usual until the wait is over', async () => {
    const now = NOW + route.wait - MINUTE;
    await poll(now);
    expectFollowed(now);
  });

  it('says so once the wait is over, and can be dismissed, without ever failing', async () => {
    const now = NOW + route.wait;
    await poll(now);
    expectNotFound(now);
  });

  it.each(['rpc-down', 'tx-read-fails'] as const)(
    'is not told apart from a failed read (%s)',
    async state => {
      const now = NOW + 30 * DAY;
      await poll(now, state);
      expectFollowed(now);
    }
  );

  it('is not a transaction still waiting in the mempool', async () => {
    const now = NOW + 30 * DAY;
    await poll(now, 'mempool');
    expectFollowed(now);
  });

  it('is not assumed with no client for the source network', async () => {
    const now = NOW + 30 * DAY;
    await pollAt({ store, scope: SCOPE, id: HASH, now, context: { getClient: () => undefined } });
    expectFollowed(now);
  });

  it('is not assumed of a source the tracker once read mined', async () => {
    store.upsert(SCOPE, seed(route, { sourceMinedAt: NOW + MINUTE }));
    const now = NOW + 30 * DAY;
    await poll(now);
    expectFollowed(now);
  });

  it('is followed again once the hash mines', async () => {
    const now = NOW + route.wait;
    await poll(now);
    await poll(now + MINUTE, 'mined', waiting);
    expectFollowed(now + MINUTE);
  });

  it('is followed again once the hash mines, even with nothing else to report', async () => {
    const now = NOW + route.wait;
    await poll(now);
    await poll(now + MINUTE, 'mined', silent);
    expectFollowed(now + MINUTE);
  });

  it('is followed again once the hash is back in the mempool', async () => {
    const now = NOW + route.wait;
    await poll(now);
    await poll(now + MINUTE, 'mempool');
    expectFollowed(now + MINUTE);
  });

  it('stays not found through a failed read', async () => {
    const now = NOW + route.wait;
    await poll(now);
    await poll(now + MINUTE, 'rpc-down');
    expectNotFound(now + MINUTE);
  });

  it('is checked every 5 minutes for a day, then only on a page load', async () => {
    const now = NOW + route.wait;
    await poll(now);
    expect(pollIntervalMs(stored(), now)).toBe(5 * MINUTE);
    expect(pollIntervalMs(stored(), NOW + DAY - MINUTE)).toBe(5 * MINUTE);
    expect(pollIntervalMs(stored(), NOW + DAY + MINUTE)).toBeUndefined();
    expect(isTracked(stored())).toBe(true);
  });

  it('is dropped by Dismiss only once not found', async () => {
    store.dismiss(SCOPE, HASH);
    expect(stored()).toBeDefined();
    await poll(NOW + route.wait);
    store.dismiss(SCOPE, HASH);
    expect(store.getSnapshot(SCOPE)).toEqual([]);
  });

  it('is still not found after a reload', async () => {
    const now = NOW + route.wait;
    await poll(now);
    store = createPendingBridgeStore({ now: () => NOW });
    expectNotFound(now);
  });
});

describe('the swap behind a CCTP burn the chain has no record of', () => {
  const route = ROUTES[0]!;
  const swap: UnfinishedCctpSwap = {
    swapTxHash: `0x${'ab'.repeat(32)}`,
    network: 'base',
    usdcAmount: 1_000_000n,
    recipient: ACCOUNT,
    at: NOW,
    burn: HASH
  };
  let store = createPendingBridgeStore({ now: () => NOW });
  let source = sourceChain(route.from);
  const spendable = () => isSwapSpendable(swap, store.getSnapshot(SCOPE));
  const poll = (now: number, state: SourceState, adapter?: BridgeAdapter) => {
    source.chain.state = state;
    return pollAt({ store, scope: SCOPE, id: HASH, now, context: source.context, adapter });
  };

  beforeEach(() => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => NOW });
    source = sourceChain(route.from);
    store.upsert(SCOPE, seed(route));
  });

  it('holds its USDC while the burn may still land', async () => {
    await poll(NOW + route.wait - MINUTE, 'unknown');
    expect(spendable()).toBe(false);
    await poll(NOW + 30 * DAY, 'mempool');
    expect(spendable()).toBe(false);
    await poll(NOW + 30 * DAY, 'rpc-down');
    expect(spendable()).toBe(false);
  });

  it('can spend its USDC again once the burn is not found', async () => {
    await poll(NOW + route.wait, 'unknown');
    expect(spendable()).toBe(true);
  });

  it('holds its USDC again if the burn shows up', async () => {
    await poll(NOW + route.wait, 'unknown');
    await poll(NOW + route.wait + MINUTE, 'mined', waiting);
    expect(spendable()).toBe(false);
  });
});
