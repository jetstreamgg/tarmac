import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { CCTP_DOMAIN, addressToBytes32 } from '../adapters/cctp/contracts';
import type { DiscoveredBurn } from '../adapters/cctp/discovery';
import type { CctpBurnLookup } from '../adapters/cctp/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge, type BridgeProgress } from '../model/pendingTransitions';
import { cctpWithdrawalRoute } from '../model/resolveRoute';
import { createCctpSwapStore } from '../store/cctpSwapStore';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverCctpBurns } from './recoverCctpBurns';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const HASH = '0x00000000000000000000000000000000000000000000000000000000000000aa' as Hex;
const OTHER = '0x00000000000000000000000000000000000000000000000000000000000000bb' as Hex;
const USDS = 5n * 10n ** 18n;
const USDC = 5_000_000n;

const burnOf = (txHash: Hex, overrides: Partial<DiscoveredBurn> = {}): DiscoveredBurn => ({
  txHash,
  blockNumber: 10n,
  amount: USDC,
  mintRecipient: addressToBytes32(ACCOUNT),
  destinationDomain: CCTP_DOMAIN.ethereum,
  ...overrides
});

const bridgeOf = (txHash: Hex) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: USDS,
    from: 'base',
    to: 'ethereum',
    route: cctpWithdrawalRoute('base'),
    txHash,
    now: NOW - 60_000
  });

const run = ({
  burns = [burnOf(HASH)],
  found = (txHash: Hex): CctpBurnLookup => ({ status: 'found', bridge: bridgeOf(txHash) }),
  progress = { kind: 'ready', nextAction: 'claim' } as BridgeProgress | null,
  store = createPendingBridgeStore({ now: () => NOW }),
  swaps = createCctpSwapStore(),
  settled = new Set<string>()
} = {}) => {
  const lookup = vi.fn(async (txHash: Hex) => found(txHash));
  const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => progress);
  const added = recoverCctpBurns({
    store,
    swaps,
    scope: SCOPE,
    network: 'base',
    burns,
    lookup,
    now: () => NOW,
    adapter: { checkProgress },
    context: { getClient: () => undefined },
    settled
  });
  return { store, swaps, added, lookup, checkProgress, settled };
};

describe('recoverCctpBurns', () => {
  beforeEach(() => localStorage.clear());

  it('adds a burn the store lacks, read as the manual form does, with its claim offered', async () => {
    const { store, added, lookup } = run();
    expect(await added).toBe(1);
    expect(lookup).toHaveBeenCalledWith(HASH);
    expect(store.getSnapshot(SCOPE)).toMatchObject([
      { txHash: HASH, from: 'base', to: 'ethereum', routeKind: 'cctp', status: 'ready', nextAction: 'claim' }
    ]);
  });

  it('skips a burn already stored, without reading it', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bridgeOf(HASH));
    const { added, lookup } = run({ store });
    expect(await added).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it('skips a burn to another chain, without reading it', async () => {
    const { added, lookup } = run({ burns: [burnOf(HASH, { destinationDomain: 6 })] });
    expect(await added).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('adds no card for a claimed burn, and never reads it again', async () => {
    const settled = new Set<string>();
    const first = run({ progress: { kind: 'arrived' }, settled });
    expect(await first.added).toBe(0);
    expect(first.store.getSnapshot(SCOPE)).toEqual([]);
    const second = run({ settled });
    expect(await second.added).toBe(0);
    expect(second.lookup).not.toHaveBeenCalled();
  });

  it('settles a burn that is not a bridge, and reads a missing receipt again', async () => {
    const settled = new Set<string>();
    await run({ found: () => ({ status: 'refused', reason: 'not-a-bridge' }), settled }).added;
    expect(settled.has(HASH)).toBe(true);
    const lagging = new Set<string>();
    await run({ found: () => ({ status: 'refused', reason: 'not-found' }), settled: lagging }).added;
    expect(lagging.size).toBe(0);
  });

  it('leaves a read error for the next run', async () => {
    const { added, settled } = run({
      found: () => {
        throw new Error('rpc down');
      }
    });
    expect(await added).toBe(0);
    expect(settled.size).toBe(0);
  });

  it.each([
    ['a wallet bundle', { bundleId: 'bundle-1' }],
    ['a queued Safe transaction', { safeTxHash: OTHER }]
  ])('leaves a burn %s with no hash may own to its card', async (_, source) => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      SCOPE,
      createPendingBridge({
        account: ACCOUNT,
        amount: USDS,
        from: 'base',
        to: 'ethereum',
        route: cctpWithdrawalRoute('base'),
        ...source,
        now: NOW - 5 * 60_000
      })
    );
    const { added, lookup } = run({ store });
    expect(await added).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('adds a burn of another amount than an unresolved bundle', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      SCOPE,
      createPendingBridge({
        account: ACCOUNT,
        amount: 2n * USDS,
        from: 'base',
        to: 'ethereum',
        route: cctpWithdrawalRoute('base'),
        bundleId: 'bundle-1',
        now: NOW - 5 * 60_000
      })
    );
    expect(await run({ store }).added).toBe(1);
  });

  it('links the oldest stopped swap of its USDC and recipient, so it is not offered again', async () => {
    const swaps = createCctpSwapStore();
    const swap = (swapTxHash: string, usdcAmount: bigint, at: number) =>
      swaps.record(SCOPE, { swapTxHash, network: 'base', usdcAmount, recipient: ACCOUNT, at });
    swap('0xold', USDC, NOW - 10 * 60_000);
    swap('0xnew', USDC, NOW - 5 * 60_000);
    swap('0xother', 2n * USDC, NOW - 20 * 60_000);
    await run({ swaps }).added;
    const byHash = Object.fromEntries(swaps.getSnapshot(SCOPE).map(entry => [entry.swapTxHash, entry.burn]));
    expect(byHash).toEqual({ '0xold': HASH, '0xnew': undefined, '0xother': undefined });
  });

  it('adds nothing the launch stored while the burn was read', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const { added } = run({
      store,
      found: txHash => {
        store.upsert(SCOPE, bridgeOf(txHash));
        return { status: 'found', bridge: bridgeOf(txHash) };
      }
    });
    expect(await added).toBe(0);
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });
});
