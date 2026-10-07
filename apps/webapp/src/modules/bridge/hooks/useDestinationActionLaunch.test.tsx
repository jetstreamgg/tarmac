/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

const mocks = vi.hoisted(() => ({
  address: '',
  launched: [] as TransactionConfig[],
  legs: [] as { names: string[]; getCallbacks: () => TxCallbacks }[]
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [1, 8453].map(id => ({ id }))
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: (names: string[], getCallbacks: () => TxCallbacks) => {
    mocks.legs.push({ names, getCallbacks });
    return new Promise<string>(() => undefined);
  }
}));

const NOW = 1_800_000_000_000;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const stored = (id: string) => pendingBridgeStore.getSnapshot(scope()).find(bridge => bridge.id === id)!;

const seedReadyClaim = () => {
  const resolved = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: resolved.route,
    txHash: '0xsource',
    now: NOW
  });
  pendingBridgeStore.upsert(scope(), applyProgress(bridge, { kind: 'ready', nextAction: 'claim' }, NOW));
  return stored('0xsource');
};

/** Opens the action modal for `bridge` and confirms it; returns the callbacks its leg reports through. */
const launchAndConfirm = (
  launch: ReturnType<typeof useDestinationActionLaunch>['launch'],
  bridge = stored('0xsource')
) => {
  act(() => launch(bridge));
  act(() => mocks.launched.at(-1)!.onConfirm!());
  return mocks.legs.at(-1)!.getCallbacks();
};

describe('useDestinationActionLaunch', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(2000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.launched = [];
    mocks.legs = [];
  });

  it('records the action at broadcast and refuses a second launch while it is sent', () => {
    const card = seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch, card);
    callbacks.onMutate({ functionName: 'claim' });
    callbacks.onStart('0xclaim');
    expect(stored('0xsource').actions).toEqual([
      expect.objectContaining({ action: 'claim', txHash: '0xclaim', status: 'sent' })
    ]);

    // The card's snapshot may predate the broadcast.
    act(() => result.current.launch(card));
    act(() => result.current.launch(stored('0xsource')));
    expect(mocks.launched).toHaveLength(1);
  });

  it('a reverted action clears, so the user can claim again', () => {
    seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch);
    callbacks.onStart('0xclaim');
    callbacks.onError(new Error('execution reverted'), '0xclaim');
    expect(stored('0xsource').actions).toEqual([]);
    act(() => result.current.launch(stored('0xsource')));
    expect(mocks.launched).toHaveLength(2);
  });

  it('a confirmed action settles the bridge', () => {
    seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch);
    callbacks.onStart('0xclaim');
    callbacks.onSuccess('0xclaim');
    expect(stored('0xsource')).toMatchObject({ status: 'claimed', actions: [{ txHash: '0xclaim' }] });
  });

  it('Retry after a non-revert failure sends no second action while the first is sent', () => {
    seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch);
    callbacks.onMutate({ functionName: 'claim' });
    callbacks.onStart('0xclaim1');
    callbacks.onError(new Error('rpc timeout'), '0xclaim1');

    // TransactionContext.handleRetry calls onConfirm when the flow has no onRetry.
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.legs).toHaveLength(1);
  });
});
