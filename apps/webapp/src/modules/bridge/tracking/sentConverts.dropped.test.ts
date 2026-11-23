/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { createCctpSwapStore, isSwapSpendable, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { resolveSentConverts } from './sentConverts';
import type { CallsStatus } from './recoverDeposits';

// A convert that will never mine (the wallet dropped or replaced it, or never
// reports its bundle) must not hold the swap's USDC forever. It is freed only
// on evidence: the chain has no record of the hash, or the wallet stays silent.

const SCOPE = 'scope';
const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const CONVERT = `0x${'ef'.repeat(32)}`;
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: `0x${'ab'.repeat(32)}`,
  network: 'base',
  usdcAmount: 1_000_000n,
  recipient: `0x${'11'.repeat(20)}`,
  at: NOW - 31 * DAY
};

const noReceipt = async (_network: string, hash: string): Promise<never> => {
  throw new TransactionReceiptNotFoundError({ hash: hash as Hex });
};
const noTransaction = async (_network: string, hash: string): Promise<never> => {
  throw new TransactionNotFoundError({ hash: hash as Hex });
};
const rpcDown = async (): Promise<never> => {
  throw new Error('rate limited');
};

describe('a convert that never mines', () => {
  let store = createCctpSwapStore();
  const stored = () => store.get(SCOPE, SWAP.swapTxHash)!;
  const expectHeld = (convert: string) => {
    expect(stored().convert).toBe(convert);
    expect(isSwapSpendable(stored(), [])).toBe(false);
  };
  const expectFreed = () => {
    // The swap stays, offered again.
    expect(stored().convert).toBeUndefined();
    expect(isSwapSpendable(stored(), [])).toBe(true);
  };

  beforeEach(() => {
    localStorage.clear();
    store = createCctpSwapStore();
  });

  describe('sent by hash', () => {
    const sentAgo = (ms: number) => store.record(SCOPE, { ...SWAP, convert: CONVERT, convertAt: NOW - ms });
    const resolve = (
      receipt: (network: string, hash: string) => Promise<{ status: 'success' | 'reverted' }>,
      transaction?: (network: string, hash: string) => Promise<unknown>
    ) =>
      resolveSentConverts({
        store,
        scope: SCOPE,
        callsStatus: vi.fn(async () => undefined),
        receipt,
        transaction,
        now: () => NOW
      });

    it('frees the swap once the chain has had no record of it for 15 minutes', async () => {
      sentAgo(15 * MINUTE);
      await resolve(noReceipt, noTransaction);
      expectFreed();
    });

    it('holds the swap before that', async () => {
      sentAgo(14 * MINUTE);
      await resolve(noReceipt, noTransaction);
      expectHeld(CONVERT);
    });

    it('holds the swap while the convert waits in the mempool', async () => {
      sentAgo(30 * DAY);
      await resolve(noReceipt, async () => ({ hash: CONVERT }));
      expectHeld(CONVERT);
    });

    it('holds the swap when the receipt read fails', async () => {
      sentAgo(30 * DAY);
      await resolve(rpcDown, noTransaction);
      expectHeld(CONVERT);
    });

    it('holds the swap when the transaction read fails', async () => {
      sentAgo(30 * DAY);
      await resolve(noReceipt, rpcDown);
      expectHeld(CONVERT);
    });

    it('holds the swap with no way to ask the chain about the transaction', async () => {
      sentAgo(30 * DAY);
      await resolve(noReceipt);
      expectHeld(CONVERT);
    });

    it('dates a link stored without its send time by its swap', async () => {
      store.record(SCOPE, { ...SWAP, at: NOW - 15 * MINUTE, convert: CONVERT });
      await resolve(noReceipt, noTransaction);
      expectFreed();
    });
  });

  describe('sent as a wallet bundle', () => {
    const sentAgo = (ms: number) =>
      store.record(SCOPE, { ...SWAP, convert: 'calls-id', convertBundled: true, convertAt: NOW - ms });
    const resolve = (callsStatus: () => Promise<CallsStatus | undefined>) =>
      resolveSentConverts({
        store,
        scope: SCOPE,
        callsStatus,
        receipt: vi.fn(async () => ({ status: 'success' }) as const),
        transaction: noTransaction,
        now: () => NOW
      });
    const walletThrows = async (): Promise<never> => {
      throw new Error('wallet_getCallsStatus: unknown bundle');
    };

    it.each([
      ['throws', walletThrows],
      ['reports nothing', async () => undefined],
      ['reports no status', async () => ({})]
    ])('frees the swap once the wallet %s about it for 30 minutes', async (_label, callsStatus) => {
      sentAgo(30 * MINUTE);
      await resolve(callsStatus);
      expectFreed();
    });

    it('holds the swap before that', async () => {
      sentAgo(29 * MINUTE);
      await resolve(walletThrows);
      expectHeld('calls-id');
    });

    it('holds the swap for as long as the wallet reports the bundle pending', async () => {
      sentAgo(30 * DAY);
      await resolve(async () => ({ status: 'pending' }));
      expectHeld('calls-id');
    });
  });
});
