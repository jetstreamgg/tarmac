import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import type { ChainReader } from '../adapters/types';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createDismissedSourceStore, DISMISSED_WATCH_MS } from '../store/dismissedSourceStore';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { dismissBridge, reviveDismissed } from './dismissedSources';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2222222222222222222222222222222222222222';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const HASH = '0x00000000000000000000000000000000000000000000000000000000000000aa' as Hex;

const unseen = (overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  ...createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: nativeWithdrawalRoute('base'),
    txHash: HASH,
    now: NOW - 30 * 60_000
  }),
  sourceUnseenAt: NOW - 10 * 60_000,
  ...overrides
});

const setup = () => {
  let now = NOW;
  const clock = () => now;
  const store = createPendingBridgeStore({ now: clock });
  const dismissed = createDismissedSourceStore({ now: clock });
  return { store, dismissed, advance: (ms: number) => (now += ms) };
};

const receiptNotFound = () => new TransactionReceiptNotFoundError({ hash: HASH });
const txNotFound = () => new TransactionNotFoundError({ hash: HASH });

const reader = ({
  receipt = async () => {
    throw receiptNotFound();
  },
  transaction = async () => {
    throw txNotFound();
  }
}: {
  receipt?: () => Promise<unknown>;
  transaction?: () => Promise<unknown>;
} = {}) => {
  const getTransactionReceipt = vi.fn(receipt);
  const getTransaction = vi.fn(transaction);
  return {
    client: { getTransactionReceipt, getTransaction } as unknown as ChainReader,
    getTransactionReceipt,
    getTransaction
  };
};

const dismissUnseen = (
  store: ReturnType<typeof setup>['store'],
  dismissed: ReturnType<typeof setup>['dismissed']
) => {
  const card = unseen();
  store.upsert(SCOPE, card);
  dismissBridge({ store, dismissed, scope: SCOPE, id: card.id });
  return card;
};

describe('dismissBridge', () => {
  beforeEach(() => localStorage.clear());

  it('drops a not-found card from the list and keeps it to be looked for', () => {
    const { store, dismissed } = setup();
    const card = dismissUnseen(store, dismissed);
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    expect(dismissed.getSnapshot(SCOPE)).toEqual([{ bridge: card, dismissedAt: NOW }]);
  });

  it('keeps nothing for a card dismissed for another reason', () => {
    const { store, dismissed } = setup();
    const card = { ...unseen({ recipient: OTHER }), account: OTHER, sourceUnseenAt: undefined };
    store.upsert(SCOPE, card);
    dismissBridge({ store, dismissed, scope: SCOPE, id: card.id });
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    expect(dismissed.getSnapshot(SCOPE)).toEqual([]);
  });

  it('keeps nothing when the card cannot be dismissed', () => {
    const { store, dismissed } = setup();
    const card = unseen({ sourceUnseenAt: undefined });
    store.upsert(SCOPE, card);
    dismissBridge({ store, dismissed, scope: SCOPE, id: card.id });
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
    expect(dismissed.getSnapshot(SCOPE)).toEqual([]);
  });
});

describe('dismissedSourceStore', () => {
  beforeEach(() => localStorage.clear());

  it('survives a reload with the amount intact', () => {
    const { store, dismissed } = setup();
    const card = dismissUnseen(store, dismissed);
    const reloaded = createDismissedSourceStore({ now: () => NOW });
    expect(reloaded.getSnapshot(SCOPE)).toEqual([{ bridge: card, dismissedAt: NOW }]);
  });

  it('stops looking a week after the dismissal', () => {
    const { store, dismissed } = setup();
    dismissUnseen(store, dismissed);
    expect(
      createDismissedSourceStore({ now: () => NOW + DISMISSED_WATCH_MS - 1 }).getSnapshot(SCOPE)
    ).toHaveLength(1);
    expect(createDismissedSourceStore({ now: () => NOW + DISMISSED_WATCH_MS }).getSnapshot(SCOPE)).toEqual(
      []
    );
  });
});

describe('reviveDismissed', () => {
  beforeEach(() => localStorage.clear());

  const revive = (chain: ChainReader | undefined) => {
    const { store, dismissed } = setup();
    const card = dismissUnseen(store, dismissed);
    const [entry] = dismissed.getSnapshot(SCOPE);
    const result = reviveDismissed({
      entry,
      scope: SCOPE,
      store,
      dismissed,
      context: { getClient: () => chain }
    });
    return { result, store, dismissed, card };
  };

  it('brings the card back, no longer marked not found, once its send mined', async () => {
    const chain = reader({ receipt: async () => ({ status: 'success' }) });
    const { result, store, dismissed, card } = revive(chain.client);
    expect(await result).toBe(true);
    expect(chain.getTransactionReceipt).toHaveBeenCalledWith({ hash: HASH });
    const [restored] = store.getSnapshot(SCOPE);
    expect(restored).toMatchObject({ id: card.id, txHash: HASH, status: 'pending' });
    expect(restored.sourceUnseenAt).toBeUndefined();
    expect(dismissed.getSnapshot(SCOPE)).toEqual([]);
  });

  it('brings it back while its send is pending on the chain', async () => {
    const chain = reader({ transaction: async () => ({ hash: HASH }) });
    const { result, store, dismissed } = revive(chain.client);
    expect(await result).toBe(true);
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
    expect(dismissed.getSnapshot(SCOPE)).toEqual([]);
  });

  it('keeps it dismissed while the chain has no record of the send', async () => {
    const { result, store, dismissed } = revive(reader().client);
    expect(await result).toBe(false);
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    expect(dismissed.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it.each([
    [
      'the receipt read fails',
      reader({
        receipt: async () => {
          throw new Error('rpc down');
        }
      })
    ],
    [
      'the transaction read fails',
      reader({
        transaction: async () => {
          throw new Error('rpc down');
        }
      })
    ]
  ])('keeps it dismissed, still looked for, when %s', async (_, chain) => {
    const { result, store, dismissed } = revive(chain.client);
    expect(await result).toBe(false);
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    expect(dismissed.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it('keeps it dismissed when the app has no client for its network', async () => {
    const { result, dismissed } = revive(undefined);
    expect(await result).toBe(false);
    expect(dismissed.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it('adds no second card when a scan already found the send', async () => {
    const { store, dismissed } = setup();
    const card = dismissUnseen(store, dismissed);
    const scanned = createPendingBridge({
      account: ACCOUNT,
      amount: card.amount,
      from: 'base',
      to: 'ethereum',
      route: nativeWithdrawalRoute('base'),
      txHash: HASH,
      now: NOW
    });
    store.upsert(SCOPE, { ...scanned, id: 'scanned' });
    const [entry] = dismissed.getSnapshot(SCOPE);
    const chain = reader({ receipt: async () => ({ status: 'success' }) });
    expect(
      await reviveDismissed({
        entry,
        scope: SCOPE,
        store,
        dismissed,
        context: { getClient: () => chain.client }
      })
    ).toBe(true);
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
    expect(store.getSnapshot(SCOPE)[0].id).toBe('scanned');
    expect(dismissed.getSnapshot(SCOPE)).toEqual([]);
  });
});
