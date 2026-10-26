/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { createCctpSwapStore, isSwapSpendable, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import type { CallsStatus } from './recoverDeposits';
import { resolveBundledConverts } from './bundledConverts';

// A convert of a stopped swap sent as a wallet bundle outlives the tab that sent it: only the wallet can tell how it ended.

const SCOPE = 'scope';
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x' + 'ab'.repeat(32),
  network: 'base',
  usdcAmount: 1_000_000n,
  recipient: '0x' + '11'.repeat(20),
  at: 1
};
const receipt = (transactionHash: string, status: 'success' | 'reverted' = 'success') => ({
  status,
  transactionHash: transactionHash as Hex,
  blockNumber: 1n,
  logs: []
});

describe('resolveBundledConverts', () => {
  let store = createCctpSwapStore();
  const stored = () => store.get(SCOPE, SWAP.swapTxHash);
  const resolve = (callsStatus: (id: string) => Promise<CallsStatus | undefined>) =>
    resolveBundledConverts({ store, scope: SCOPE, callsStatus });

  beforeEach(() => {
    localStorage.clear();
    store = createCctpSwapStore();
    store.record(SCOPE, SWAP);
    store.markConvert(SCOPE, SWAP.swapTxHash, 'calls-id', { bundle: true });
  });

  it('drops the swap once the wallet reports its convert ran', async () => {
    const callsStatus = vi.fn(async () => ({ status: 'success', receipts: [receipt('0xconvert')] }) as const);
    await resolve(callsStatus);
    expect(callsStatus).toHaveBeenCalledWith('calls-id');
    expect(stored()).toBeUndefined();
  });

  it.each<[string, CallsStatus]>([
    ['failed', { status: 'failure', receipts: [] }],
    [
      'reverted in one of its transactions',
      { status: 'success', receipts: [receipt('0xapprove'), receipt('0xconvert', 'reverted')] }
    ]
  ])('offers the swap again once its convert bundle %s', async (_, reported) => {
    await resolve(async () => reported);
    expect(stored()).toBeDefined();
    expect(stored()!.convert).toBeUndefined();
    expect(isSwapSpendable(stored()!, [])).toBe(true);
  });

  // Unknown is never a failure: the bundle may still land.
  it.each<[string, () => Promise<CallsStatus | undefined>]>([
    ['is still pending', async () => ({ status: 'pending' })],
    ['did not answer', async () => undefined],
    ['reported success without receipts', async () => ({ status: 'success', receipts: [] })],
    [
      'threw',
      async () => {
        throw new Error('wallet_getCallsStatus not supported');
      }
    ]
  ])('keeps the convert sent while the wallet %s', async (_, callsStatus) => {
    await resolve(callsStatus);
    expect(stored()).toMatchObject({ convert: 'calls-id', convertBundled: true });
    expect(isSwapSpendable(stored()!, [])).toBe(false);
  });

  it('never asks the wallet about a convert sent with a hash, or a swap with none', async () => {
    store.markConvert(SCOPE, SWAP.swapTxHash, '0xconvert');
    store.record(SCOPE, { ...SWAP, swapTxHash: '0x' + 'cd'.repeat(32) });
    const callsStatus = vi.fn(async () => ({ status: 'failure' }) as const);
    await resolve(callsStatus);
    expect(callsStatus).not.toHaveBeenCalled();
    expect(stored()!.convert).toBe('0xconvert');
  });

  it('leaves a convert sent again while the wallet answered about the old one', async () => {
    await resolve(async () => {
      store.markConvert(SCOPE, SWAP.swapTxHash, 'calls-new', { bundle: true });
      return { status: 'failure' };
    });
    expect(stored()).toMatchObject({ convert: 'calls-new', convertBundled: true });
  });
});
