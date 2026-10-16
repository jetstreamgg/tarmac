import { describe, expect, it } from 'vitest';
import {
  BUNDLE_UNSEEN_MS,
  canDismiss,
  createPendingBridge,
  failBundle,
  isBundleUnseen,
  pollIntervalMs
} from './pendingTransitions';
import { nativeDepositRoute } from './resolveRoute';
import type { PendingBridge } from './types';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';

const card = (ids: { bundleId?: string; txHash?: string; safeTxHash?: string } = { bundleId: 'bundle-1' }) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: nativeDepositRoute('base'),
    ...ids,
    now: NOW
  });

describe('failBundle', () => {
  it('fails a wallet bundle that has no deposit on chain, with its reason and when', () => {
    expect(failBundle(card(), 'source-tx-reverted', NOW + MINUTE)).toMatchObject({
      id: 'bundle-1',
      status: 'failed',
      failureReason: 'source-tx-reverted',
      settledAt: NOW + MINUTE
    });
  });

  it('never fails a bundle whose deposit was found on chain: its funds are moving', () => {
    const found = { ...card(), txHash: '0xdeposit' };
    expect(failBundle(found, 'source-tx-reverted', NOW)).toBe(found);
  });

  it.each<[string, PendingBridge]>([
    ['failed', { ...card(), status: 'failed', failureReason: 'rejected', settledAt: NOW }],
    ['arrived', { ...card(), status: 'arrived', settledAt: NOW }]
  ])('leaves a bundle already %s as it is', (_, settled) => {
    expect(failBundle(settled, 'source-tx-reverted', NOW + MINUTE)).toBe(settled);
  });

  it('leaves a card that is not a bundle as it is', () => {
    const sent = card({ txHash: '0xsource' });
    const queued = card({ safeTxHash: '0xsafe' });
    expect(failBundle(sent, 'source-tx-reverted', NOW)).toBe(sent);
    expect(failBundle(queued, 'source-tx-reverted', NOW)).toBe(queued);
  });
});

describe('a wallet bundle not found on chain', () => {
  it('is unseen and can be dismissed from 30 minutes, not at 29', () => {
    expect(BUNDLE_UNSEEN_MS).toBe(30 * MINUTE);
    const bundle = card();
    expect(isBundleUnseen(bundle, NOW + 29 * MINUTE)).toBe(false);
    expect(canDismiss(bundle, NOW + 29 * MINUTE)).toBe(false);
    expect(isBundleUnseen(bundle, NOW + 30 * MINUTE)).toBe(true);
    expect(canDismiss(bundle, NOW + 30 * MINUTE)).toBe(true);
  });

  it('cannot be dismissed when the caller gives no clock', () => {
    expect(canDismiss(card())).toBe(false);
  });

  it('can never be dismissed once its deposit was found, however long it has been', () => {
    const found = { ...card(), txHash: '0xdeposit' };
    expect(isBundleUnseen(found, NOW + 31 * MINUTE)).toBe(false);
    expect(canDismiss(found, NOW + 31 * MINUTE)).toBe(false);
    expect(canDismiss(found, NOW + 30 * 24 * 60 * MINUTE)).toBe(false);
  });

  it('is not offered a Dismiss once settled', () => {
    const failed = failBundle(card(), 'source-tx-reverted', NOW);
    expect(isBundleUnseen(failed, NOW + 31 * MINUTE)).toBe(false);
    expect(canDismiss(failed, NOW + 31 * MINUTE)).toBe(false);
  });

  it('counts its 30 minutes from when it started, not from when it was created', () => {
    const bundle = { ...card(), startedAt: NOW + 10 * MINUTE };
    expect(canDismiss(bundle, NOW + 39 * MINUTE)).toBe(false);
    expect(canDismiss(bundle, NOW + 40 * MINUTE)).toBe(true);
  });

  it('keeps being checked while it waits for its hash', () => {
    expect(pollIntervalMs(card(), NOW + MINUTE)).toBeDefined();
    expect(pollIntervalMs(card(), NOW + 2 * 60 * MINUTE)).toBeDefined();
  });
});

describe('canDismiss, cards that are not bundles', () => {
  it('still lets a queued Safe transaction be dismissed with or without a clock', () => {
    const queued = card({ safeTxHash: '0xsafe' });
    expect(canDismiss(queued)).toBe(true);
    expect(canDismiss(queued, NOW)).toBe(true);
  });

  it('never lets a sent transaction be dismissed', () => {
    expect(canDismiss(card({ txHash: '0xsource' }), NOW + 60 * MINUTE)).toBe(false);
  });
});
