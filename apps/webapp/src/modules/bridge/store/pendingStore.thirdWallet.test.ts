import { beforeEach, describe, expect, it } from 'vitest';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';

// A bridge brought into the list of a wallet that neither sent nor receives
// it can leave that list; a party's own bridge never leaves it this way.

const NOW = 1_800_000_000_000;
const VIEWER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SENDER = '0x00000000000000000000000000000000000b0b01';
const RECIPIENT = '0x00000000000000000000000000000000000c0c02';
const SCOPE = pendingScopeKey({ account: VIEWER, familyChainId: 1 });
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

const listAfterDismiss = (card: PendingBridge) => {
  const store = createPendingBridgeStore({ now: () => NOW });
  store.upsert(SCOPE, card);
  store.dismiss(SCOPE, card.id);
  return store.getSnapshot(SCOPE);
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
});
