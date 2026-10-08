import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';
import { applyProgress } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const bridge = (overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  id: '0xsource',
  account: ACCOUNT,
  amount: 123456789012345678901234n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: NOW,
  etaAt: NOW + 20 * 60_000,
  txHash: '0xsource',
  actions: [],
  ...overrides
});

describe('pendingScopeKey', () => {
  it('scopes by lowercase account and chain family, not by network', () => {
    expect(pendingScopeKey({ account: ACCOUNT.toUpperCase().replace('0X', '0x'), familyChainId: 1 })).toBe(
      SCOPE
    );
    expect(pendingScopeKey({ account: ACCOUNT, familyChainId: 314310 })).not.toBe(SCOPE);
  });
});

describe('createPendingBridgeStore', () => {
  let now = NOW;
  const make = () => createPendingBridgeStore({ now: () => now });

  beforeEach(() => {
    now = NOW;
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('round-trips bigint amounts through storage', () => {
    make().upsert(SCOPE, bridge());
    expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
  });

  it('keeps scopes apart', () => {
    const store = make();
    store.upsert(SCOPE, bridge());
    expect(store.getSnapshot(pendingScopeKey({ account: ACCOUNT, familyChainId: 314310 }))).toEqual([]);
  });

  it('returns a stable snapshot until something changes', () => {
    const store = make();
    store.upsert(SCOPE, bridge());
    const first = store.getSnapshot(SCOPE);
    expect(store.getSnapshot(SCOPE)).toBe(first);
    store.update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
    expect(store.getSnapshot(SCOPE)).not.toBe(first);
  });

  it('lists newest first and does not duplicate an entry with the same id', () => {
    const store = make();
    store.upsert(SCOPE, bridge({ id: '0xa', txHash: '0xa', startedAt: NOW }));
    store.upsert(SCOPE, bridge({ id: '0xb', txHash: '0xb', startedAt: NOW + 1 }));
    store.upsert(SCOPE, bridge({ id: '0xa', txHash: '0xa', startedAt: NOW }));
    expect(store.getSnapshot(SCOPE).map(entry => entry.id)).toEqual(['0xb', '0xa']);
  });

  it('a repeated upsert keeps the progress the bridge already made', () => {
    const store = make();
    const ready = bridge({
      status: 'ready',
      routeData: { messageHash: '0xm' },
      actions: [{ action: 'claim', txHash: '0xclaim', at: NOW + 1 }]
    });
    store.upsert(SCOPE, ready);
    store.upsert(SCOPE, bridge({ startedAt: NOW + 5 * 60_000, etaAt: NOW + 25 * 60_000 }));
    expect(store.getSnapshot(SCOPE)).toEqual([ready]);
  });

  it('two stores on one localStorage keep both writes (two tabs before the storage event)', () => {
    const tabA = make();
    const tabB = make();
    tabA.upsert(SCOPE, bridge());
    expect(tabB.getSnapshot(SCOPE)).toHaveLength(1);
    tabA.upsert(SCOPE, bridge({ id: '0xa', txHash: '0xa', startedAt: NOW + 1 }));
    tabB.upsert(SCOPE, bridge({ id: '0xb', txHash: '0xb', startedAt: NOW + 2 }));
    tabA.update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
    tabB.update(SCOPE, '0xa', current => ({ ...current, routeData: { output: '1' } }));
    const stored = make().getSnapshot(SCOPE);
    expect(stored.map(entry => entry.id)).toEqual(['0xb', '0xa', '0xsource']);
    expect(stored.find(entry => entry.id === '0xsource')?.status).toBe('ready');
    expect(stored.find(entry => entry.id === '0xa')?.routeData).toEqual({ output: '1' });
  });

  it('matches a Safe bridge by its Safe tx hash, so a second submit does not duplicate it', () => {
    const store = make();
    store.upsert(SCOPE, bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: undefined }));
    store.upsert(SCOPE, bridge({ id: '0xexec', safeTxHash: '0xsafe', txHash: '0xexec' }));
    expect(store.getSnapshot(SCOPE)).toEqual([
      bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: '0xexec' })
    ]);
  });

  it('update is a no-op for an unknown id or an unchanged entry', () => {
    const store = make();
    const listener = vi.fn();
    store.upsert(SCOPE, bridge());
    store.subscribe(listener);
    store.update(SCOPE, '0xmissing', current => ({ ...current, status: 'ready' }));
    store.update(SCOPE, '0xsource', current => current);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers on writes and on writes from another tab', () => {
    const store = make();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.upsert(SCOPE, bridge());
    expect(listener).toHaveBeenCalledTimes(1);

    make().upsert(SCOPE, bridge({ id: '0xother', txHash: '0xother', startedAt: NOW + 1 }));
    window.dispatchEvent(new StorageEvent('storage', { key: `bridgePending:v1:${SCOPE}` }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot(SCOPE)).toHaveLength(2);

    window.dispatchEvent(new StorageEvent('storage', { key: 'somethingElse' }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('drops settled bridges after 90 days but keeps active ones forever', () => {
    make().upsert(SCOPE, bridge({ id: '0xold', txHash: '0xold', status: 'arrived', settledAt: NOW }));
    make().upsert(SCOPE, bridge({ id: '0xstuck', txHash: '0xstuck', status: 'ready', startedAt: NOW - 1 }));
    now = NOW + 91 * DAY;
    expect(
      make()
        .getSnapshot(SCOPE)
        .map(entry => entry.id)
    ).toEqual(['0xstuck']);
  });

  it('keeps updating the session copy once storage writes fail', () => {
    const store = make();
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    store.upsert(SCOPE, bridge());
    store.update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
    expect(store.getSnapshot(SCOPE).map(entry => entry.status)).toEqual(['ready']);
    expect(setItem).toHaveBeenCalled();
    expect(localStorage.getItem(`bridgePending:v1:${SCOPE}`)).toBeNull();
    setItem.mockRestore();
  });

  it('skips entries whose fields the app cannot use', () => {
    const good = { ...bridge(), amount: bridge().amount.toString() };
    const bad = [
      { ...good, id: '0x1', from: 'moon' },
      { ...good, id: '0x2', to: 42 },
      { ...good, id: '0x3', nextAction: 'teleport' },
      { ...good, id: '0x4', actions: [{ action: 'teleport', txHash: '0xt', at: NOW }] },
      { ...good, id: '0x5', actions: ['claim'] },
      { ...good, id: '0x6', txHash: 7 },
      { ...good, id: '0x7', safeTxHash: {} },
      { ...good, id: '0x8', routeData: { messageHash: 1 } },
      { ...good, id: '0x9', requiresClaim: 'yes' }
    ];
    localStorage.setItem(`bridgePending:v1:${SCOPE}`, JSON.stringify([...bad, good]));
    expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
  });

  it('keeps a sent action through storage and skips an unknown action status', () => {
    const sent = bridge({
      status: 'ready',
      actions: [{ action: 'claim', txHash: '0xc', at: NOW, status: 'sent' }]
    });
    const stored = { ...sent, amount: sent.amount.toString() };
    const bad = {
      ...stored,
      id: '0xa',
      actions: [{ action: 'claim', txHash: '0xc', at: NOW, status: 'maybe' }]
    };
    localStorage.setItem(`bridgePending:v1:${SCOPE}`, JSON.stringify([bad, stored]));
    expect(make().getSnapshot(SCOPE)).toEqual([sent]);
  });

  it('keeps the Safe marker of a sent action through storage', () => {
    const sent = bridge({
      status: 'ready',
      actions: [{ action: 'claim', txHash: '0xsafeclaim', at: NOW, status: 'sent', safe: true }]
    });
    make().upsert(SCOPE, sent);
    expect(make().getSnapshot(SCOPE)).toEqual([sent]);
  });

  it('keeps an invalidated action through storage', () => {
    const reproving = bridge({
      routeKind: 'native',
      from: 'optimism',
      to: 'ethereum',
      actions: [{ action: 'prove', txHash: '0xp', at: NOW, status: 'invalidated' }]
    });
    make().upsert(SCOPE, reproving);
    expect(make().getSnapshot(SCOPE)).toEqual([reproving]);
  });

  it('skips malformed entries and unreadable storage', () => {
    localStorage.setItem(
      `bridgePending:v1:${SCOPE}`,
      JSON.stringify([{ id: 'broken' }, { ...bridge(), amount: bridge().amount.toString() }])
    );
    expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
    localStorage.setItem(`bridgePending:v1:${SCOPE}`, '{not json');
    expect(make().getSnapshot(SCOPE)).toEqual([]);
  });

  describe('never loses what it cannot read', () => {
    const KEY = `bridgePending:v1:${SCOPE}`;
    // A newer bundle (a later route kind) wrote this entry under the same key.
    const future = { ...bridge({ id: '0xfuture', txHash: '0xfuture' }), amount: '1', routeKind: 'hyperlane' };
    const seed = () =>
      localStorage.setItem(
        KEY,
        JSON.stringify([future, { ...bridge(), amount: bridge().amount.toString() }])
      );
    const storedIds = () =>
      (JSON.parse(localStorage.getItem(KEY)!) as { id: string }[]).map(entry => entry.id);

    it('an upsert keeps an entry it cannot parse', () => {
      seed();
      make().upsert(SCOPE, bridge({ id: '0xnew', txHash: '0xnew', startedAt: NOW + 1 }));
      expect(storedIds()).toEqual(expect.arrayContaining(['0xnew', '0xsource', '0xfuture']));
    });

    it('an update keeps an entry it cannot parse', () => {
      seed();
      make().update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
      expect(storedIds()).toEqual(expect.arrayContaining(['0xsource', '0xfuture']));
    });

    it('keeps a copy of an unreadable value before replacing it', () => {
      localStorage.setItem(KEY, '[{"id":"0xfuture", not json');
      make().upsert(SCOPE, bridge());
      expect(localStorage.getItem(`${KEY}:unreadable`)).toBe('[{"id":"0xfuture", not json');
      expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
    });

    it('does not replace an unreadable value it could not copy', () => {
      localStorage.setItem(KEY, '{not json');
      const setItem = localStorage.setItem.bind(localStorage);
      const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        if (key.endsWith(':unreadable')) throw new Error('QuotaExceededError');
        setItem(key, value);
      });
      const store = make();
      store.upsert(SCOPE, bridge());
      expect(spy).toHaveBeenCalledWith(`${KEY}:unreadable`, '{not json');
      spy.mockRestore();
      expect(localStorage.getItem(KEY)).toBe('{not json');
      expect(store.getSnapshot(SCOPE)).toEqual([bridge()]);
    });
  });

  describe('after a failed write, another tab never wipes what only this session has', () => {
    const KEY = `bridgePending:v1:${SCOPE}`;

    it("keeps a session-only bridge and picks up the other tab's entry", () => {
      const store = make();
      store.subscribe(() => {});
      const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      store.upsert(SCOPE, bridge());
      spy.mockRestore();

      make().upsert(SCOPE, bridge({ id: '0xother', txHash: '0xother', startedAt: NOW - 1 }));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));

      expect(store.getSnapshot(SCOPE).map(entry => entry.id)).toEqual(['0xsource', '0xother']);
    });

    it('keeps the session progress of a bridge storage still has as before', () => {
      make().upsert(SCOPE, bridge());
      const store = make();
      store.subscribe(() => {});
      const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      store.update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
      spy.mockRestore();

      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));

      expect(store.getSnapshot(SCOPE).map(entry => entry.status)).toEqual(['ready']);
    });

    describe("once storage works again, this session's next write keeps another tab's progress", () => {
      const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; status: string }[];

      const failOnce = () => {
        const setItem = localStorage.setItem.bind(localStorage);
        let failed = false;
        vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
          if (failed) return setItem(key, value);
          failed = true;
          throw new Error('QuotaExceededError');
        });
      };

      const run = (deliverStorageEvent: boolean) => {
        make().upsert(SCOPE, bridge({ id: '0xx', txHash: '0xx' }));
        make().upsert(SCOPE, bridge({ id: '0xy', txHash: '0xy', startedAt: NOW - 1 }));
        const store = make();
        store.subscribe(() => {});
        store.getSnapshot(SCOPE);
        failOnce();
        store.update(SCOPE, '0xy', current => ({ ...current, etaAt: current.etaAt + 1 }));
        make().update(SCOPE, '0xx', current => ({ ...current, status: 'ready' }));
        if (deliverStorageEvent) window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
        store.update(SCOPE, '0xy', current => ({ ...current, status: 'ready' }));
        vi.restoreAllMocks();
        return store;
      };

      it('with the storage event delivered', () => {
        const store = run(true);
        expect(stored().map(entry => entry.status)).toEqual(['ready', 'ready']);
        expect(store.getSnapshot(SCOPE).map(entry => entry.status)).toEqual(['ready', 'ready']);
      });

      it('before the storage event arrives', () => {
        run(false);
        expect(stored().map(entry => entry.status)).toEqual(['ready', 'ready']);
      });

      it('and a bridge dismissed while writes failed stays dismissed', () => {
        make().upsert(SCOPE, bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: undefined }));
        make().upsert(SCOPE, bridge({ id: '0xy', txHash: '0xy', startedAt: NOW - 1 }));
        const store = make();
        failOnce();
        store.dismiss(SCOPE, '0xsafe');
        store.update(SCOPE, '0xy', current => ({ ...current, status: 'ready' }));
        vi.restoreAllMocks();
        expect(stored().map(entry => entry.id)).toEqual(['0xy']);
      });
    });
  });

  describe('dismiss', () => {
    const KEY = `bridgePending:v1:${SCOPE}`;
    const queued = (id: string, overrides: Partial<PendingBridge> = {}) =>
      bridge({ id, safeTxHash: id, txHash: undefined, ...overrides });

    it('drops one queued Safe bridge and keeps the rest, including entries it cannot parse', () => {
      const future = { id: '0xfuture', status: 'expired' };
      localStorage.setItem(KEY, JSON.stringify([future]));
      const store = make();
      store.upsert(SCOPE, queued('0xsafe'));
      store.upsert(SCOPE, queued('0xother', { startedAt: NOW - 1 }));
      store.dismiss(SCOPE, '0xsafe');
      expect(store.getSnapshot(SCOPE).map(entry => entry.id)).toEqual(['0xother']);
      expect(
        make()
          .getSnapshot(SCOPE)
          .map(entry => entry.id)
      ).toEqual(['0xother']);
      expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toContainEqual(future);
    });

    it('is a no-op for an unknown id or a bridge already on chain', () => {
      const store = make();
      store.upsert(SCOPE, bridge());
      const before = store.getSnapshot(SCOPE);
      store.dismiss(SCOPE, '0xnope');
      store.dismiss(SCOPE, '0xsource');
      expect(store.getSnapshot(SCOPE)).toBe(before);
    });

    describe('keeps a Safe bridge another tab saw execute, though the card still offered Dismiss', () => {
      const executeInOtherTab = () =>
        make().update(SCOPE, '0xsafe', current =>
          applyProgress(current, { kind: 'source-executed', txHash: '0xexecuted' }, NOW + 1000)
        );

      it('before the storage event arrives', () => {
        const store = make();
        store.subscribe(() => {});
        store.upsert(SCOPE, queued('0xsafe'));
        store.getSnapshot(SCOPE);
        executeInOtherTab();
        store.dismiss(SCOPE, '0xsafe');
        const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; txHash?: string }[];
        expect(stored.find(entry => entry.id === '0xsafe')?.txHash).toBe('0xexecuted');
      });

      it('after the storage event arrives', () => {
        const store = make();
        store.subscribe(() => {});
        store.upsert(SCOPE, queued('0xsafe'));
        executeInOtherTab();
        window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
        store.dismiss(SCOPE, '0xsafe');
        expect(store.getSnapshot(SCOPE).find(entry => entry.id === '0xsafe')?.txHash).toBe('0xexecuted');
      });
    });
  });
});
