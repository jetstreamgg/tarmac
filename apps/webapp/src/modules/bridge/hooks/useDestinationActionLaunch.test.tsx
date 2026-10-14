/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { applyProgress, createPendingBridge, dropSentAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

const mocks = vi.hoisted(() => ({
  address: '',
  isSafe: false,
  chainIds: [1, 8453],
  walletChainId: 1,
  canSwitchChain: true,
  switches: [] as { chainId: number; onSuccess?: () => void }[],
  launched: [] as TransactionConfig[],
  session: {} as TxCallbacks,
  legs: [] as { names: string[]; getCallbacks: () => TxCallbacks }[],
  replay: {
    params: undefined as
      | undefined
      | {
          enabled: boolean;
          network?: string;
          routeData?: Record<string, string>;
          chainId?: number;
          getCallbacks: () => TxCallbacks;
        },
    ready: false,
    error: null as Error | null,
    execute: (() => undefined) as () => void,
    reset: (() => undefined) as () => void
  }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
  useChainId: () => 1,
  useChains: () => mocks.chainIds.map(id => ({ id }))
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.isSafe
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    txCallbacks: mocks.session,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    canSwitchChain: mocks.canSwitchChain,
    handleSwitchChain: (request: { chainId: number; onSuccess?: () => void }) => mocks.switches.push(request)
  })
}));
vi.mock('@/modules/ui/hooks/useResetPausedRunOnClose', () => ({ useResetPausedRunOnClose: () => undefined }));
vi.mock('./useOpStackReplayLegs', () => ({
  useOpStackReplayLegs: (params: NonNullable<typeof mocks.replay.params>) => {
    mocks.replay.params = params;
    const { ready, error, execute, reset } = mocks.replay;
    return { ready, error, execute, reset };
  }
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

const ROUTE_DATA = { msgHash: '0xhash', l2TxHash: '0xl2', relayCalldata: '0xrelay' };

const seedReadyReplay = () => {
  const resolved = resolveBridgeRoute({ from: 'ethereum', to: 'base', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: resolved.route,
    txHash: '0xdeposit',
    now: NOW
  });
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'replay', routeData: ROUTE_DATA }, NOW)
  );
  return stored('0xdeposit');
};

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
    mocks.chainIds = [1, 8453];
    mocks.walletChainId = 1;
    mocks.canSwitchChain = true;
    mocks.switches = [];
    mocks.isSafe = false;
    mocks.launched = [];
    mocks.session = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
    mocks.legs = [];
    mocks.replay = { params: undefined, ready: false, error: null, execute: vi.fn(), reset: vi.fn() };
  });

  it("can't launch, and the card disables its button, when the destination network can't be pinned", () => {
    const card = seedReadyClaim();
    mocks.chainIds = [8453];
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(card)).toBe(false);
    act(() => result.current.launch(card));
    expect(mocks.launched).toHaveLength(0);
  });

  it('can launch a ready action on a network the app can switch to, and not once it is sent', () => {
    const card = seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(card)).toBe(true);
    const callbacks = launchAndConfirm(result.current.launch, card);
    callbacks.onMutate({ functionName: 'claim' });
    callbacks.onStart('0xclaim');
    expect(result.current.canLaunch(stored('0xsource'))).toBe(false);
  });

  it('records the action at broadcast and refuses a second launch while it is sent', () => {
    const card = seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch, card);
    callbacks.onMutate({ functionName: 'claim' });
    callbacks.onStart('0xclaim');
    expect(stored('0xsource').actions).toEqual([
      { action: 'claim', txHash: '0xclaim', at: expect.any(Number), status: 'sent' }
    ]);

    // The card's snapshot may predate the broadcast.
    act(() => result.current.launch(card));
    act(() => result.current.launch(stored('0xsource')));
    expect(mocks.launched).toHaveLength(1);
  });

  it('marks an action a Safe sent, so the tracker reads its Safe tx hash from the Safe service', () => {
    mocks.isSafe = true;
    seedReadyClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    const callbacks = launchAndConfirm(result.current.launch);
    callbacks.onStart('0xsafeclaim');
    expect(stored('0xsource').actions).toEqual([
      expect.objectContaining({ txHash: '0xsafeclaim', status: 'sent', safe: true })
    ]);
  });

  it('tells a Safe its sent action waits for execution, and an EOA nothing', () => {
    seedReadyClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    launchAndConfirm(result.current.launch).onStart('0xclaim');
    expect(result.current.actionHint(stored('0xsource'))).toBeUndefined();

    mocks.isSafe = true;
    mocks.launched = [];
    pendingBridgeStore.update(scope(), '0xsource', current => dropSentAction(current, '0xclaim'));
    rerender();
    launchAndConfirm(result.current.launch).onStart('0xsafeclaim');
    expect(result.current.actionHint(stored('0xsource'))).toEqual({ kind: 'safe-executing' });
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

  describe('a wallet on another network', () => {
    it('is switched first, and the modal opens once the wallet reports the network', () => {
      const card = seedReadyClaim();
      mocks.walletChainId = 8453;
      const { result, rerender } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(card)).toBe(true);
      act(() => result.current.launch(card));
      expect(mocks.switches.map(({ chainId }) => chainId)).toEqual([1]);
      expect(mocks.launched).toHaveLength(0);

      act(() => mocks.switches[0].onSuccess!());
      expect(mocks.launched).toHaveLength(0);
      mocks.walletChainId = 1;
      rerender();
      expect(mocks.launched).toHaveLength(1);
      rerender();
      expect(mocks.launched).toHaveLength(1);
    });

    it('opens nothing when the switch is rejected', () => {
      const card = seedReadyClaim();
      mocks.walletChainId = 8453;
      const { result, rerender } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card));
      rerender();
      expect(mocks.switches).toHaveLength(1);
      expect(mocks.launched).toHaveLength(0);
    });

    it("can't launch when the wallet can't switch, as a Safe can't, and tells it to switch in Safe", () => {
      const card = seedReadyClaim();
      mocks.walletChainId = 8453;
      mocks.canSwitchChain = false;
      mocks.isSafe = true;
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(card)).toBe(false);
      expect(result.current.actionHint(card)).toEqual({
        kind: 'switch-network',
        network: 'ethereum',
        safe: true
      });
    });

    it('gives no hint when the app can switch, or the wallet is already there', () => {
      const card = seedReadyClaim();
      mocks.walletChainId = 8453;
      const { result, rerender } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.actionHint(card)).toBeUndefined();
      mocks.walletChainId = 1;
      mocks.canSwitchChain = false;
      rerender();
      expect(result.current.actionHint(card)).toBeUndefined();
    });
  });

  describe('the replay of an Ethereum to OP Stack deposit', () => {
    const launchReplay = () => {
      const card = seedReadyReplay();
      mocks.walletChainId = 8453;
      const hook = renderHook(() => useDestinationActionLaunch());
      act(() => hook.result.current.launch(card));
      return hook;
    };

    it('builds the legs on the pinned L2 from the stored message', () => {
      launchReplay();
      expect(mocks.replay.reset).toHaveBeenCalled();
      expect(mocks.replay.params).toMatchObject({
        enabled: true,
        network: 'base',
        routeData: ROUTE_DATA,
        chainId: 8453
      });
      expect(mocks.launched).toHaveLength(1);
    });

    it('sends once prepared when Confirm comes first, and never on the mock executor', () => {
      const { rerender } = launchReplay();
      act(() => mocks.launched[0].onConfirm!());
      expect(mocks.replay.execute).not.toHaveBeenCalled();
      mocks.replay.ready = true;
      rerender();
      expect(mocks.replay.execute).toHaveBeenCalledTimes(1);
      rerender();
      expect(mocks.replay.execute).toHaveBeenCalledTimes(1);
      expect(mocks.legs).toHaveLength(0);
    });

    it('sends at once when already prepared', () => {
      mocks.replay.ready = true;
      launchReplay();
      act(() => mocks.launched[0].onConfirm!());
      expect(mocks.replay.execute).toHaveBeenCalledTimes(1);
    });

    it('reports a message or simulation failure to the modal, for Retry', () => {
      const { rerender } = launchReplay();
      act(() => mocks.launched[0].onConfirm!());
      mocks.replay.error = new Error('simulation reverted');
      rerender();
      expect(mocks.replay.execute).not.toHaveBeenCalled();
      expect(mocks.session.onError).toHaveBeenCalledWith(mocks.replay.error, '');
    });

    it('records the replay it sends, as for any destination action', () => {
      mocks.replay.ready = true;
      launchReplay();
      act(() => mocks.launched[0].onConfirm!());
      const callbacks = mocks.replay.params!.getCallbacks();
      callbacks.onStart('0xreplay');
      expect(stored('0xdeposit').actions).toEqual([
        { action: 'replay', txHash: '0xreplay', at: expect.any(Number), status: 'sent' }
      ]);
      callbacks.onSuccess('0xreplay');
      expect(stored('0xdeposit')).toMatchObject({ status: 'pending', nextAction: undefined });
    });

    it('waits for the switch before building, so the simulation runs on the L2', () => {
      const card = seedReadyReplay();
      mocks.walletChainId = 1;
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card));
      expect(mocks.replay.params?.enabled).toBe(false);
      expect(mocks.switches.map(({ chainId }) => chainId)).toEqual([8453]);
    });
  });
});
