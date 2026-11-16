import { beforeEach, describe, expect, it } from 'vitest';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';

// A bridge brought into the list of a wallet that neither sent nor receives
// it can leave that list; a party's own bridge never leaves it this way.

const NOW = 1_800_000_000_000;
const VIEWER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SENDER = '0x00000000000000000000000000000000000b0b01';
const RECIPIENT = '0x00000000000000000000000000000000000c0c02';
const HASH = `0x${'c4'.repeat(32)}`;

const CARD: PendingBridge = {
  id: HASH,
  account: SENDER,
  recipient: RECIPIENT,
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'ready',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: NOW - 60 * 60_000,
  sourceMinedAt: NOW - 59 * 60_000,
  etaAt: NOW - 40 * 60_000,
  txHash: HASH,
  actions: []
};

// One list per case: a store keeps its lists for the session.
let lists = 0;
const listAfterDismiss = (card: PendingBridge) => {
  const store = createPendingBridgeStore({ now: () => NOW });
  const scope = pendingScopeKey({ account: VIEWER, familyChainId: ++lists });
  store.upsert(scope, card);
  store.dismiss(scope, card.id);
  return store.getSnapshot(scope);
};

describe('dismissing a bridge from the list of a wallet', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ['ready to claim', CARD],
    ['on its way', { ...CARD, status: 'pending' as const }],
    ['minted to its sender', { ...CARD, recipient: SENDER }],
    ['in checksum case', { ...CARD, account: SENDER.toUpperCase().replace('0X', '0x') }]
  ])('removes one it neither sent nor receives, %s', (_label, card) => {
    expect(listAfterDismiss(card)).toEqual([]);
  });

  it.each([
    ['it sent to another wallet', { ...CARD, account: VIEWER }],
    ['it sent to itself', { ...CARD, account: VIEWER, recipient: undefined }],
    ['it receives', { ...CARD, recipient: VIEWER }],
    ['it receives, in checksum case', { ...CARD, recipient: VIEWER.toUpperCase().replace('0X', '0x') }]
  ])('keeps one %s', (_label, card) => {
    expect(listAfterDismiss(card as PendingBridge)).toHaveLength(1);
  });

  // Its recipient, another wallet of this browser, acts on it from this list.
  const CLAIM = { action: 'claim' as const, txHash: `0x${'c1'.repeat(32)}`, at: NOW - 60_000 };

  it.each([
    [
      'a claim its recipient sent that has not mined',
      { ...CARD, actions: [{ ...CLAIM, status: 'sent' as const }] }
    ],
    [
      'a claim sent as a wallet bundle that has not mined',
      { ...CARD, actions: [{ ...CLAIM, txHash: 'calls-id', status: 'sent' as const, bundle: true as const }] }
    ],
    [
      "a claim's sale that has not mined",
      {
        ...CARD,
        status: 'claimed' as const,
        nextAction: undefined,
        settledAt: NOW - 30_000,
        actions: [{ ...CLAIM, nextLegTxHash: `0x${'c2'.repeat(32)}`, nextLegAt: NOW - 30_000 }]
      }
    ]
  ])('keeps one with %s: its only record', (_label, card) => {
    expect(listAfterDismiss(card as PendingBridge)).toHaveLength(1);
  });

  const HOURS = 60 * 60_000;

  it.each([
    ['a claim', { ...CLAIM, at: NOW - 4 * HOURS, status: 'sent' as const }],
    [
      'a claim from a Safe still waiting for its signatures',
      { ...CLAIM, at: NOW - 4 * HOURS, status: 'sent' as const, safe: true as const }
    ]
  ])('keeps one with %s nothing has settled hours later: it may still execute', (_label, action) => {
    expect(listAfterDismiss({ ...CARD, actions: [action] })).toHaveLength(1);
  });

  it("removes one with a claim's sale sent over 3 hours ago: mined or dropped by now", () => {
    expect(
      listAfterDismiss({
        ...CARD,
        status: 'claimed',
        nextAction: undefined,
        settledAt: NOW - 4 * HOURS,
        actions: [
          { ...CLAIM, at: NOW - 4 * HOURS, nextLegTxHash: `0x${'c2'.repeat(32)}`, nextLegAt: NOW - 3 * HOURS }
        ]
      })
    ).toEqual([]);
  });

  it('removes one whose claim mined', () => {
    expect(
      listAfterDismiss({
        ...CARD,
        status: 'claimed',
        nextAction: undefined,
        settledAt: NOW - 30_000,
        actions: [CLAIM]
      })
    ).toEqual([]);
  });
});
