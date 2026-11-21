import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const KEY = `bridgePending:v1:${SCOPE}`;
const HASH = '0x00000000000000000000000000000000000000000000000000000000000000d1';
const ETA_MS = nativeDepositRoute('base').etaMinutes * MINUTE;

const card = (ids: { bundleId?: string; callsId?: string; txHash?: string; safeTxHash?: string } = {}) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: nativeDepositRoute('base'),
    ...(Object.keys(ids).length ? ids : { bundleId: 'bundle-1', callsId: '0xcalls' }),
    now: NOW
  });

describe('pendingStore, a wallet bundle card', () => {
  let now = NOW;
  const make = () => createPendingBridgeStore({ now: () => now });
  const only = (store: ReturnType<typeof make>, id: string) =>
    store.getSnapshot(SCOPE).find(bridge => bridge.id === id);

  beforeEach(() => {
    now = NOW;
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  describe('resolveBundle', () => {
    it('gives the card its hash and starts its clock when the deposit mined', () => {
      const store = make();
      store.upsert(SCOPE, card());
      now = NOW + 20 * MINUTE;
      store.resolveBundle(SCOPE, 'bundle-1', HASH, NOW + 3 * MINUTE);
      expect(store.getSnapshot(SCOPE)).toHaveLength(1);
      expect(only(store, 'bundle-1')).toMatchObject({
        txHash: HASH,
        status: 'pending',
        startedAt: NOW + 3 * MINUTE,
        etaAt: NOW + 3 * MINUTE + ETA_MS
      });
    });

    it("starts the clock on the store's now when the mining time is unknown", () => {
      const store = make();
      store.upsert(SCOPE, card());
      now = NOW + 7 * MINUTE;
      store.resolveBundle(SCOPE, 'bundle-1', HASH);
      expect(only(store, 'bundle-1')).toMatchObject({ txHash: HASH, startedAt: now, etaAt: now + ETA_MS });
    });

    it('keeps the hash in storage, so a reload still tracks the deposit', () => {
      make().upsert(SCOPE, card());
      make().resolveBundle(SCOPE, 'bundle-1', HASH, NOW + MINUTE);
      expect(only(make(), 'bundle-1')).toMatchObject({ txHash: HASH, bundleId: 'bundle-1' });
    });

    const UPPER = `0x${HASH.slice(2).toUpperCase()}`;
    it.each<[string, PendingBridge]>([
      ['a recovered card under that hash', card({ txHash: UPPER })],
      ['a Safe card that executed under it', { ...card({ safeTxHash: '0xsafe' }), txHash: UPPER }]
    ])('drops the card when %s already tracks the deposit', (_, other) => {
      const store = make();
      store.upsert(SCOPE, card());
      store.upsert(SCOPE, other);
      store.resolveBundle(SCOPE, 'bundle-1', HASH);
      const cards = store.getSnapshot(SCOPE);
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe(other.id);
    });

    it('never moves a card that already has its hash', () => {
      const store = make();
      store.upsert(SCOPE, { ...card(), txHash: '0xfirst', startedAt: NOW + MINUTE });
      const before = store.getSnapshot(SCOPE);
      now = NOW + 30 * MINUTE;
      store.resolveBundle(SCOPE, 'bundle-1', HASH, NOW + 5 * MINUTE);
      expect(store.getSnapshot(SCOPE)).toEqual(before);
    });

    it('never overwrites the hash another tab already gave the card, before its storage event arrives', () => {
      const tab = make();
      tab.subscribe(() => {});
      tab.upsert(SCOPE, card());
      make().resolveBundle(SCOPE, 'bundle-1', '0xfirst', NOW + MINUTE);
      tab.resolveBundle(SCOPE, 'bundle-1', HASH, NOW + 2 * MINUTE);
      expect(make().getSnapshot(SCOPE)).toMatchObject([
        { id: 'bundle-1', txHash: '0xfirst', startedAt: NOW + MINUTE }
      ]);
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
      expect(tab.getSnapshot(SCOPE)).toMatchObject([{ id: 'bundle-1', txHash: '0xfirst' }]);
    });

    it.each<[string, PendingBridge]>([
      ['settled', { ...card(), status: 'failed', failureReason: 'rejected', settledAt: NOW }],
      ['not a bundle', { ...card({ safeTxHash: '0xsafe' }) }]
    ])('leaves a card that is %s as it is', (_, existing) => {
      const store = make();
      store.upsert(SCOPE, existing);
      const before = store.getSnapshot(SCOPE);
      store.resolveBundle(SCOPE, existing.id, HASH, NOW + MINUTE);
      expect(store.getSnapshot(SCOPE)).toEqual(before);
    });

    it('does nothing for an id it does not hold', () => {
      const store = make();
      store.upsert(SCOPE, card());
      const before = store.getSnapshot(SCOPE);
      store.resolveBundle(SCOPE, 'bundle-unknown', HASH, NOW + MINUTE);
      expect(store.getSnapshot(SCOPE)).toEqual(before);
    });
  });

  describe('dismiss', () => {
    it('keeps a card not found on chain for 29 minutes and drops it at 30', () => {
      const store = make();
      store.upsert(SCOPE, card());
      now = NOW + 29 * MINUTE;
      store.dismiss(SCOPE, 'bundle-1');
      expect(store.getSnapshot(SCOPE)).toHaveLength(1);
      now = NOW + 30 * MINUTE;
      store.dismiss(SCOPE, 'bundle-1');
      expect(store.getSnapshot(SCOPE)).toEqual([]);
      expect(make().getSnapshot(SCOPE)).toEqual([]);
    });

    it('keeps a card whose deposit another tab found, though this tab still offered Dismiss', () => {
      const tab = make();
      tab.subscribe(() => {});
      tab.upsert(SCOPE, card());
      make().resolveBundle(SCOPE, 'bundle-1', HASH, NOW + MINUTE);
      now = NOW + 31 * MINUTE;
      tab.dismiss(SCOPE, 'bundle-1');
      expect(make().getSnapshot(SCOPE)).toMatchObject([{ id: 'bundle-1', txHash: HASH }]);
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
      expect(only(tab, 'bundle-1')).toMatchObject({ txHash: HASH });
    });
  });

  it('reads a bundle card back after a reload with its bundle and calls ids', () => {
    make().upsert(SCOPE, card());
    expect(only(make(), 'bundle-1')).toMatchObject({ bundleId: 'bundle-1', callsId: '0xcalls' });
  });
});
