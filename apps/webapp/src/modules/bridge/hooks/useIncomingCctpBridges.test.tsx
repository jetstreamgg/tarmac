/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useIncomingCctpBridges } from './useIncomingCctpBridges';

const mocks = vi.hoisted(() => ({ address: undefined as string | undefined }));

vi.mock('./usePendingScope', async () => {
  const { pendingScopeKey } = await import('../store/pendingStore');
  return {
    usePendingScope: () => ({
      account: mocks.address,
      familyChainId: 1,
      scope: mocks.address ? pendingScopeKey({ account: mocks.address, familyChainId: 1 }) : undefined
    })
  };
});

const NOW = 1_800_000_000_000;
let seq = 0;
const nextAccount = () => `0x${(5000 + ++seq).toString(16).padStart(40, '0')}`;
const scopeOf = (account: string, familyChainId = 1) => pendingScopeKey({ account, familyChainId });

const cctp = (sender: string, overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  id: `0xburn${++seq}`,
  account: sender,
  amount: 1n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'ready',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: NOW,
  etaAt: NOW + 20 * 60_000,
  actions: [],
  ...overrides
});

describe('useIncomingCctpBridges', () => {
  let recipient: string;
  let sender: string;

  beforeEach(() => {
    recipient = nextAccount();
    sender = nextAccount();
    mocks.address = recipient;
  });

  it("lists another account's CCTP bridge to this wallet, with the sender's scope", () => {
    const sent = cctp(sender, { recipient: recipient.toUpperCase().replace('0X', '0x') });
    pendingBridgeStore.upsert(scopeOf(sender), sent);
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toEqual([{ scope: scopeOf(sender), bridge: sent }]);
  });

  it('matches a checksummed connected address against a lower-case recipient', () => {
    mocks.address = `0x${'AbCd'.repeat(10)}`;
    const sent = cctp(sender, { recipient: mocks.address.toLowerCase() });
    pendingBridgeStore.upsert(scopeOf(sender), sent);
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toEqual([{ scope: scopeOf(sender), bridge: sent }]);
  });

  it('skips bridges to someone else, with no recipient, of other routes, and to an L2', () => {
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient: nextAccount() }));
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender));
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient, routeKind: 'native' }));
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient, from: 'ethereum', to: 'base' }));
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toEqual([]);
  });

  it("leaves out the wallet's own list and another chain family's", () => {
    pendingBridgeStore.upsert(scopeOf(recipient), cctp(recipient, { recipient }));
    pendingBridgeStore.upsert(scopeOf(sender, 314310), cctp(sender, { recipient }));
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toEqual([]);
  });

  it('leaves out a burn the wallet already has in its own list, by its hash in any case', () => {
    const lower = `0x${'ab'.repeat(32)}`;
    const upper = lower.toUpperCase().replace('0X', '0x');
    for (const [sent, own] of [
      [lower, upper],
      [upper, lower]
    ]) {
      localStorage.clear();
      pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient, id: sent, txHash: sent }));
      pendingBridgeStore.upsert(scopeOf(recipient), cctp(sender, { recipient, id: own, txHash: own }));
      const { result } = renderHook(() => useIncomingCctpBridges());
      expect(result.current).toEqual([]);
    }
  });

  it('drops a listed burn once the wallet adds it to its own list', () => {
    const hash = `0x${'cd'.repeat(32)}`;
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient, id: hash, txHash: hash }));
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toHaveLength(1);
    act(() =>
      pendingBridgeStore.upsert(scopeOf(recipient), cctp(sender, { recipient, id: hash, txHash: hash }))
    );
    expect(result.current).toEqual([]);
  });

  it('lists them newest first, across senders', () => {
    const other = nextAccount();
    const older = cctp(sender, { recipient, startedAt: NOW - 1 });
    const newer = cctp(other, { recipient, startedAt: NOW });
    pendingBridgeStore.upsert(scopeOf(sender), older);
    pendingBridgeStore.upsert(scopeOf(other), newer);
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current.map(entry => entry.bridge.id)).toEqual([newer.id, older.id]);
  });

  it("follows a write to the sender's list, and keeps the same result otherwise", () => {
    const sent = cctp(sender, { recipient });
    pendingBridgeStore.upsert(scopeOf(sender), sent);
    const { result, rerender } = renderHook(() => useIncomingCctpBridges());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    act(() =>
      pendingBridgeStore.update(scopeOf(sender), sent.id, bridge => ({ ...bridge, status: 'claimed' }))
    );
    expect(result.current[0].bridge.status).toBe('claimed');
  });

  it('lists nothing while disconnected', () => {
    pendingBridgeStore.upsert(scopeOf(sender), cctp(sender, { recipient }));
    mocks.address = undefined;
    const { result } = renderHook(() => useIncomingCctpBridges());
    expect(result.current).toEqual([]);
  });
});
