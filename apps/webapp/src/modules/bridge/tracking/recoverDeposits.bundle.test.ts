import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex, Log } from 'viem';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { BASE_DEPOSIT_LOGS, BASE_DEPOSIT_TX } from '../adapters/nativeDeposit/depositFixtures';
import { depositsInLogs, type DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge } from '../model/pendingTransitions';
import { cctpWithdrawalRoute, nativeDepositRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import type { BundleReceipt } from './bundleDeposit';
import { recoverDeposits, type CallsStatus } from './recoverDeposits';

const NOW = 1_800_000_000_000;
const SENT_AT = NOW - 10 * 60_000;
const MINED_AT = NOW - 9 * 60_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const AMOUNT = 5n * 10n ** 18n;

const deposit = (overrides: Partial<DiscoveredDeposit> = {}): DiscoveredDeposit => ({
  txHash: '0xdeposit',
  blockNumber: 100n,
  to: 'base',
  amount: AMOUNT,
  recipient: ACCOUNT,
  ...overrides
});

const bundleCard = (
  bundleId: string,
  overrides: {
    recipient?: string;
    amount?: bigint;
    startedAt?: number;
    callsId?: string;
    account?: string;
  } = {}
) =>
  createPendingBridge({
    account: overrides.account ?? ACCOUNT,
    amount: overrides.amount ?? AMOUNT,
    from: 'ethereum',
    to: 'base',
    ...(overrides.recipient && { recipient: overrides.recipient }),
    route: nativeDepositRoute('base'),
    bundleId,
    ...(overrides.callsId && { callsId: overrides.callsId }),
    now: overrides.startedAt ?? SENT_AT
  });

const run = (
  deposits: DiscoveredDeposit[],
  store: ReturnType<typeof createPendingBridgeStore>,
  options: {
    blockTime?: (blockNumber: bigint) => Promise<number | undefined>;
    chainNow?: number;
    callsStatus?: (callsId: string) => Promise<CallsStatus | undefined>;
    scope?: string;
    account?: string;
  } = {}
) =>
  recoverDeposits({
    store,
    scope: options.scope ?? SCOPE,
    account: options.account ?? ACCOUNT,
    deposits,
    now: () => NOW,
    blockTime: options.blockTime ?? (async () => MINED_AT),
    adapter: { checkProgress: vi.fn<BridgeAdapter['checkProgress']>(async () => null) },
    context: { getClient: () => undefined },
    settled: new Set<string>(),
    chainNow: options.chainNow,
    callsStatus: options.callsStatus
  });

describe('recoverDeposits, a wallet bundle card with no hash', () => {
  beforeEach(() => localStorage.clear());

  it('gets the hash of its deposit, so the tracker follows it, and adds no second card', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    expect(await run([deposit()], store)).toBe(0);
    const cards = store.getSnapshot(SCOPE);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: 'bundle-1',
      bundleId: 'bundle-1',
      txHash: '0xdeposit',
      startedAt: MINED_AT
    });
  });

  it('is never filled by a deposit to another recipient, which gets its own card', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    expect(await run([deposit({ recipient: OTHER })], store)).toBe(1);
    const bundle = store.getSnapshot(SCOPE).find(bridge => bridge.id === 'bundle-1');
    expect(bundle?.txHash).toBeUndefined();
  });

  it('is never filled by a deposit of another amount', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1', { amount: AMOUNT + 1n }));
    await run([deposit()], store);
    expect(store.getSnapshot(SCOPE).find(bridge => bridge.id === 'bundle-1')?.txHash).toBeUndefined();
  });

  it('fills two bundle cards of the same amount with one deposit each', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    store.upsert(SCOPE, bundleCard('bundle-2'));
    expect(await run([deposit(), deposit({ txHash: '0xsecond', blockNumber: 101n })], store)).toBe(0);
    const hashes = store
      .getSnapshot(SCOPE)
      .map(bridge => bridge.txHash)
      .sort();
    expect(hashes).toEqual(['0xdeposit', '0xsecond']);
  });

  it('a recipient entered on the card matches a deposit to that recipient', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1', { recipient: OTHER }));
    expect(await run([deposit({ recipient: OTHER.toLowerCase() as `0x${string}` })], store)).toBe(0);
    expect(store.getSnapshot(SCOPE)[0].txHash).toBe('0xdeposit');
  });
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('recoverDeposits, which bundle card takes which deposit', () => {
  beforeEach(() => localStorage.clear());

  it('gives the oldest card the earliest deposit, whatever order the store holds them in', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-new', { startedAt: SENT_AT }));
    store.upsert(SCOPE, bundleCard('bundle-old', { startedAt: SENT_AT - 5 * MINUTE }));
    const minedAt: Record<string, number> = { '100': SENT_AT - 4 * MINUTE, '101': MINED_AT };
    expect(
      await run([deposit({ txHash: '0xsecond', blockNumber: 101n }), deposit()], store, {
        blockTime: async block => minedAt[block.toString()],
        chainNow: NOW
      })
    ).toBe(0);
    const hashOf = (id: string) => store.getSnapshot(SCOPE).find(bridge => bridge.id === id)?.txHash;
    expect(hashOf('bundle-old')).toBe('0xdeposit');
    expect(hashOf('bundle-new')).toBe('0xsecond');
  });

  it('never takes a deposit mined well before the card started, which gets its own card', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-b'));
    expect(
      await run([deposit({ txHash: '0xearlier' })], store, {
        blockTime: async () => SENT_AT - 20 * MINUTE,
        chainNow: NOW
      })
    ).toBe(1);
    const cards = store.getSnapshot(SCOPE);
    expect(cards).toHaveLength(2);
    expect(cards.find(bridge => bridge.id === 'bundle-b')?.txHash).toBeUndefined();
    expect(cards.find(bridge => bridge.id === '0xearlier')).toBeDefined();
  });

  it('matches on a fork whose chain runs 41 hours behind, and starts the card on the device clock', async () => {
    const behind = 41 * HOUR;
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    expect(
      await run([deposit()], store, {
        blockTime: async () => SENT_AT + MINUTE - behind,
        chainNow: NOW - behind
      })
    ).toBe(0);
    const cards = store.getSnapshot(SCOPE);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: 'bundle-1', txHash: '0xdeposit', startedAt: SENT_AT + MINUTE });
  });

  it('matches when the device clock runs 50 minutes ahead of the chain', async () => {
    const ahead = 50 * MINUTE;
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    expect(
      await run([deposit()], store, {
        blockTime: async () => SENT_AT + MINUTE - ahead,
        chainNow: NOW - ahead
      })
    ).toBe(0);
    expect(store.getSnapshot(SCOPE)).toMatchObject([
      { id: 'bundle-1', txHash: '0xdeposit', startedAt: SENT_AT + MINUTE }
    ]);
  });

  it('starts a recovered deposit on the device clock', async () => {
    const behind = 41 * HOUR;
    const store = createPendingBridgeStore({ now: () => NOW });
    expect(
      await run([deposit()], store, { blockTime: async () => MINED_AT - behind, chainNow: NOW - behind })
    ).toBe(1);
    expect(store.getSnapshot(SCOPE)).toMatchObject([{ id: '0xdeposit', startedAt: MINED_AT }]);
  });
});

describe('recoverDeposits, a bundle the wallet reports on', () => {
  beforeEach(() => localStorage.clear());

  const sender = BASE_DEPOSIT_TX.from;
  const scope = pendingScopeKey({ account: sender, familyChainId: 1 });
  const HASH = '0x00000000000000000000000000000000000000000000000000000000000000d1' as Hex;
  const receipt = (status: BundleReceipt['status'], logs = BASE_DEPOSIT_LOGS): BundleReceipt =>
    ({ status, transactionHash: HASH, blockNumber: 100n, logs }) as unknown as BundleReceipt;
  const [found] = depositsInLogs(
    BASE_DEPOSIT_LOGS.map(
      log => ({ ...log, transactionHash: HASH, blockNumber: 100n, removed: false }) as Log
    ),
    sender
  );
  const card = () =>
    bundleCard('bundle-1', {
      account: sender,
      amount: found.amount,
      callsId: '0xcalls',
      ...(found.recipient.toLowerCase() !== sender.toLowerCase() && { recipient: found.recipient })
    });
  const recover = (
    store: ReturnType<typeof createPendingBridgeStore>,
    callsStatus: (callsId: string) => Promise<CallsStatus | undefined>,
    deposits: DiscoveredDeposit[] = []
  ) => run(deposits, store, { scope, account: sender, callsStatus, chainNow: NOW });

  it('gives the card its deposit from the receipts the wallet reports, with no second card from the scan', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(scope, card());
    const callsStatus = vi.fn(async () => ({ status: 'success' as const, receipts: [receipt('success')] }));
    expect(await recover(store, callsStatus, [found])).toBe(0);
    expect(callsStatus).toHaveBeenCalledWith('0xcalls');
    expect(store.getSnapshot(scope)).toMatchObject([{ id: 'bundle-1', txHash: HASH, startedAt: MINED_AT }]);
  });

  it('fails a card the wallet reports failed with no deposit among its receipts', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(scope, card());
    await recover(store, async () => ({ status: 'failure', receipts: [receipt('reverted')] }));
    expect(store.getSnapshot(scope)).toMatchObject([
      { id: 'bundle-1', status: 'failed', failureReason: 'source-tx-reverted' }
    ]);
    expect(store.getSnapshot(scope)[0].txHash).toBeUndefined();
  });

  it('tracks the deposit of a bundle the wallet reports failed when the deposit itself mined', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(scope, card());
    await recover(store, async () => ({ status: 'failure', receipts: [receipt('success')] }));
    expect(store.getSnapshot(scope)).toMatchObject([{ id: 'bundle-1', status: 'pending', txHash: HASH }]);
  });

  it.each([
    ['pending', async () => ({ status: 'pending' as const })],
    ['an unknown status', async () => ({ receipts: [receipt('success')] })],
    ['no answer', async () => undefined]
  ])('leaves the card waiting on %s', async (_, callsStatus) => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(scope, card());
    await recover(store, callsStatus as (callsId: string) => Promise<CallsStatus | undefined>);
    expect(store.getSnapshot(scope)).toMatchObject([{ id: 'bundle-1', status: 'pending' }]);
    expect(store.getSnapshot(scope)[0].txHash).toBeUndefined();
  });

  it('asks nothing for a card with no calls id', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(scope, bundleCard('bundle-1', { account: sender, amount: found.amount }));
    const callsStatus = vi.fn(async () => undefined);
    await recover(store, callsStatus);
    expect(callsStatus).not.toHaveBeenCalled();
  });
});

describe('recoverDeposits, a wallet answer it cannot read', () => {
  beforeEach(() => localStorage.clear());

  const noLogs = {
    status: 'success',
    transactionHash: '0xd2',
    blockNumber: 100n
  } as unknown as BundleReceipt;

  it('still gives the card its deposit from the scan when the wallet reports a receipt with no logs', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1', { callsId: '0xcalls' }));
    await run([deposit()], store, {
      chainNow: NOW,
      callsStatus: async () => ({ status: 'success', receipts: [noLogs] })
    });
    expect(store.getSnapshot(SCOPE).map(bridge => bridge.txHash)).toEqual(['0xdeposit']);
  });

  it('still scans the chain when the wallet status read throws', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1', { callsId: '0xcalls' }));
    await run([deposit()], store, {
      chainNow: NOW,
      callsStatus: async () => {
        throw new Error('Unsupported method');
      }
    });
    expect(store.getSnapshot(SCOPE).map(bridge => bridge.txHash)).toEqual(['0xdeposit']);
  });

  it("resolves another card from the wallet's receipts though one card's answer is unreadable", async () => {
    const sender = BASE_DEPOSIT_TX.from;
    const scope = pendingScopeKey({ account: sender, familyChainId: 1 });
    const HASH = '0x00000000000000000000000000000000000000000000000000000000000000d1' as Hex;
    const [found] = depositsInLogs(
      BASE_DEPOSIT_LOGS.map(
        log => ({ ...log, transactionHash: HASH, blockNumber: 100n, removed: false }) as Log
      ),
      sender
    );
    const recipient = found.recipient.toLowerCase() !== sender.toLowerCase() ? found.recipient : undefined;
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      scope,
      bundleCard('bundle-1', { account: sender, amount: found.amount, callsId: '0xbad', recipient })
    );
    store.upsert(
      scope,
      bundleCard('bundle-2', { account: sender, amount: found.amount, callsId: '0xgood', recipient })
    );
    const good = { status: 'success', transactionHash: HASH, blockNumber: 100n, logs: BASE_DEPOSIT_LOGS };
    await run([], store, {
      scope,
      account: sender,
      chainNow: NOW,
      callsStatus: async id => ({
        status: 'success',
        receipts: [(id === '0xgood' ? good : noLogs) as unknown as BundleReceipt]
      })
    });
    expect(store.getSnapshot(scope).find(bridge => bridge.id === 'bundle-2')?.txHash).toBe(HASH);
  });
});

describe('recoverDeposits, a CCTP bundle the wallet reports on', () => {
  beforeEach(() => localStorage.clear());

  const sender = BASE_BURN_TX.from.toLowerCase();
  const scope = pendingScopeKey({ account: sender, familyChainId: 1 });
  const HASH = `0x${'b'.repeat(64)}` as Hex;

  // The burn mined on the L2, whose block numbers Ethereum doesn't share.
  it("starts the card when its burn mined, read on the L2's chain", async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      scope,
      createPendingBridge({
        account: sender,
        amount: BASE_BURN_AMOUNT * 10n ** 12n,
        from: 'base',
        to: 'ethereum',
        route: cctpWithdrawalRoute('base'),
        bundleId: 'bundle-1',
        callsId: '0xcalls',
        now: SENT_AT
      })
    );
    const burn = {
      status: 'success',
      transactionHash: HASH,
      blockNumber: 42n,
      logs: BASE_BURN_LOGS.map(({ address, data, topics }) => ({ address, data, topics }))
    } as unknown as BundleReceipt;
    await run([], store, {
      scope,
      account: sender,
      chainNow: NOW,
      blockTime: async (_: bigint, from?: BridgeNetworkId) => (from === 'base' ? MINED_AT : undefined),
      callsStatus: async () => ({ status: 'success', receipts: [burn] })
    });
    expect(store.getSnapshot(scope)).toMatchObject([{ id: 'bundle-1', txHash: HASH, startedAt: MINED_AT }]);
  });
});
