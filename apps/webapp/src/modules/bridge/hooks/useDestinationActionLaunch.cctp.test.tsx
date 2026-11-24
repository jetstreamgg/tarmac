/**
 * @vitest-environment happy-dom
 */
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// The hook invalidates balance reads once an action confirms.
const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type ClaimParams = {
  enabled: boolean;
  routeData?: Record<string, string>;
  chainId?: number;
  account?: string;
  batch?: boolean;
  getCallbacks: () => TxCallbacks;
};

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 1,
  canSwitchChain: true,
  batch: false,
  launched: [] as TransactionConfig[],
  updates: [] as { sessionId: string; partial: Record<string, unknown> }[],
  mockLegs: [] as string[][],
  claim: {
    params: undefined as undefined | ClaimParams,
    calls: [] as { functionName: string }[],
    isBatch: false,
    ready: false,
    error: null as Error | null,
    execute: (() => undefined) as () => void,
    reset: (() => undefined) as () => void
  },
  replayEnabled: false,
  redeemEnabled: false,
  txStatus: 'idle' as string,
  activeSessionId: undefined as string | undefined,
  safe: false
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
  useChainId: () => 1,
  useConfig: () => ({}),
  useChains: () => [{ id: 1 }, { id: 8453 }]
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.safe,
  useSafeWalletStatus: () => 'not-safe'
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: () => mocks.batch,
  useBatchSupportPending: () => false
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: (sessionId: string, partial: Record<string, unknown>) =>
      mocks.updates.push({ sessionId, partial }),
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: mocks.txStatus,
    isModalOpen: true,
    isMinimized: false,
    activeSessionId: mocks.activeSessionId,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: mocks.canSwitchChain, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: () => undefined
}));
vi.mock('./useOpStackReplayLegs', () => ({
  useOpStackReplayLegs: (params: { enabled: boolean }) => {
    mocks.replayEnabled = params.enabled;
    return { ready: false, error: null, execute: () => undefined, reset: () => undefined };
  }
}));
vi.mock('./useArbitrumRedeemLegs', () => ({
  useArbitrumRedeemLegs: (params: { enabled: boolean }) => {
    mocks.redeemEnabled = params.enabled;
    return { ready: false, error: null, execute: () => undefined, reset: () => undefined };
  }
}));
vi.mock('./useCctpClaimLegs', () => ({
  CCTP_CLAIM_FUNCTION: 'receiveMessage',
  useCctpClaimLegs: (params: ClaimParams) => {
    mocks.claim.params = params;
    const { calls, isBatch, ready, error, execute, reset } = mocks.claim;
    return { calls, isBatch, ready, error, execute, reset };
  }
}));
vi.mock('./useCctpConvertLegs', () => ({
  useCctpConvertLegs: () => ({
    calls: [],
    isBatch: false,
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
// A native withdrawal's Ethereum legs; this file launches none.
vi.mock('./useNativeWithdrawalActionLegs', () => ({
  useNativeWithdrawalActionLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: (names: string[]) => {
    mocks.mockLegs.push(names);
    return new Promise<string>(() => undefined);
  }
}));

const NOW = 1_800_000_000_000;
const ROUTE_DATA = { cctpMessage: '0xmessage', cctpAttestation: '0xattestation' };
const CLAIM_CALLS = [
  { functionName: 'receiveMessage' },
  { functionName: 'approve' },
  { functionName: 'sellGem' }
];
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });

const seedCctpClaim = (recipient?: string) => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok' || resolved.route.kind !== 'cctp') throw new Error('no CCTP route');
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: resolved.route,
    txHash: '0xburn',
    now: NOW,
    ...(recipient && { recipient })
  });
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'claim', routeData: ROUTE_DATA }, NOW)
  );
  return pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;
};

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
    applyProgress(bridge, { kind: 'ready', nextAction: 'replay', routeData: { msgHash: '0xhash' } }, NOW)
  );
  return pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xdeposit')!;
};

const stepLabels = () =>
  (
    mocks.updates.at(-1)?.partial.steps as
      { label: string; tokenSymbol: string; targetTokenSymbol?: string }[] | undefined
  )?.map(step => [step.label, step.tokenSymbol, step.targetTokenSymbol].filter(Boolean).join(' '));

describe('useDestinationActionLaunch: CCTP claim', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(3000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.walletChainId = 1;
    mocks.canSwitchChain = true;
    mocks.batch = false;
    mocks.launched = [];
    mocks.updates = [];
    mocks.mockLegs = [];
    mocks.claim = {
      params: undefined,
      calls: [],
      isBatch: false,
      ready: false,
      error: null,
      execute: vi.fn(),
      reset: vi.fn()
    };
    mocks.replayEnabled = false;
    mocks.redeemEnabled = false;
    mocks.txStatus = TxStatus.IDLE;
    mocks.activeSessionId = undefined;
    mocks.safe = false;
  });

  it('counts the card as claiming from Confirm until its run ends, its sale included', () => {
    mocks.claim.ready = true;
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    const { sessionId } = mocks.launched.at(-1)!;
    mocks.activeSessionId = sessionId;
    mocks.txStatus = TxStatus.LOADING;
    rerender();
    // Not before its Confirm: the modal may still be another card's.
    expect(result.current.claiming).toBeUndefined();

    act(() => mocks.launched.at(-1)!.onConfirm!());
    for (const status of [TxStatus.INITIALIZED, TxStatus.LOADING]) {
      mocks.txStatus = status;
      rerender();
      expect(result.current.claiming).toEqual({ scope: scope(), bridgeId: card.id });
    }
    for (const status of [TxStatus.SUCCESS, TxStatus.ERROR, TxStatus.CANCELLED, TxStatus.IDLE]) {
      mocks.txStatus = status;
      rerender();
      expect(result.current.claiming).toBeUndefined();
    }
    // Another session in flight isn't this claim.
    mocks.txStatus = TxStatus.LOADING;
    mocks.activeSessionId = 'another-session';
    rerender();
    expect(result.current.claiming).toBeUndefined();
  });

  it("doesn't carry a past run into a new modal before its own Confirm", () => {
    mocks.claim.ready = true;
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    mocks.activeSessionId = mocks.launched.at(-1)!.sessionId;
    act(() => mocks.launched.at(-1)!.onConfirm!());
    mocks.txStatus = TxStatus.ERROR;
    rerender();

    // Launched again, its gate in flight before the Confirm reaches the run.
    act(() => result.current.launch(card));
    mocks.txStatus = TxStatus.INITIALIZED;
    rerender();
    expect(result.current.claiming).toBeUndefined();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(result.current.claiming).toEqual({ scope: scope(), bridgeId: card.id });
  });

  it("doesn't count another action in flight as a claim", () => {
    mocks.walletChainId = 8453;
    const card = seedReadyReplay();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    mocks.activeSessionId = mocks.launched.at(-1)!.sessionId;
    act(() => mocks.launched.at(-1)!.onConfirm!());
    mocks.txStatus = TxStatus.LOADING;
    rerender();
    expect(result.current.claiming).toBeUndefined();
  });

  describe('the toast of a run that fails after its claim', () => {
    const CLAIMED = 'USDC claimed, not converted to USDS';
    const confirmClaim = () => {
      mocks.claim.ready = true;
      const card = seedCctpClaim();
      const hook = renderHook(() => useDestinationActionLaunch());
      act(() => hook.result.current.launch(card));
      const launched = mocks.launched.at(-1)!;
      act(() => launched.onConfirm!());
      return { ...hook, card, launched, callbacks: mocks.claim.params!.getCallbacks() };
    };
    const toastUpdates = () => mocks.updates.filter(update => 'toast' in update.partial);
    const mutate = (callbacks: TxCallbacks, functionName?: string) =>
      act(() =>
        callbacks.onMutate(
          functionName ? ({ functionName } as unknown as Parameters<TxCallbacks['onMutate']>[0]) : undefined
        )
      );

    it('says the USDC was claimed once a leg after the claim starts: the claim mined before it', () => {
      const { launched, callbacks } = confirmClaim();
      expect(launched.toast?.error).toBe('Claim failed');
      mutate(callbacks, 'receiveMessage');
      expect(toastUpdates()).toEqual([]);

      mutate(callbacks, 'sellGem');
      expect(toastUpdates()).toEqual([
        {
          sessionId: launched.sessionId,
          partial: { toast: { ...launched.toast, error: CLAIMED } }
        }
      ]);
    });

    it('says it from the approve too, once', () => {
      const { callbacks } = confirmClaim();
      mutate(callbacks, 'receiveMessage');
      mutate(callbacks, 'approve');
      mutate(callbacks, 'sellGem');
      expect(toastUpdates()).toHaveLength(1);
      expect(toastUpdates()[0].partial.toast).toMatchObject({ error: CLAIMED });
    });

    it('keeps Claim failed for a bundle: its calls succeed or fail together', () => {
      const { callbacks } = confirmClaim();
      mutate(callbacks);
      expect(toastUpdates()).toEqual([]);
    });

    it("keeps Claim failed for a Safe: its next leg doesn't mean the claim executed", () => {
      mocks.safe = true;
      const { callbacks } = confirmClaim();
      mutate(callbacks, 'receiveMessage');
      mutate(callbacks, 'sellGem');
      expect(toastUpdates()).toEqual([]);
    });

    it("leaves a newer Confirm's toast alone", () => {
      const { result, card, callbacks } = confirmClaim();
      act(() => result.current.launch(card));
      act(() => mocks.launched.at(-1)!.onConfirm!());
      mutate(callbacks, 'sellGem');
      expect(toastUpdates()).toEqual([]);
    });
  });

  it("builds the claim on Ethereum from the card's attested message", () => {
    const card = seedCctpClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(mocks.claim.params?.enabled).toBe(false);

    act(() => result.current.launch(card));
    expect(mocks.claim.params).toMatchObject({
      enabled: true,
      chainId: 1,
      routeData: ROUTE_DATA,
      account: mocks.address,
      batch: false
    });
    expect(mocks.replayEnabled).toBe(false);
    expect(mocks.redeemEnabled).toBe(false);
  });

  it('builds nothing while the wallet is on another network', () => {
    mocks.walletChainId = 8453;
    const card = seedCctpClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    expect(mocks.claim.params?.enabled).toBe(false);
  });

  it('sends the claim legs on Confirm, never the mock executor', () => {
    mocks.claim.ready = true;
    const card = seedCctpClaim();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.claim.execute).toHaveBeenCalledTimes(1);
    expect(mocks.mockLegs).toEqual([]);
  });

  it('holds a Confirm until the claim is built, then sends it once', () => {
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.claim.execute).not.toHaveBeenCalled();

    mocks.claim.ready = true;
    rerender();
    rerender();
    expect(mocks.claim.execute).toHaveBeenCalledTimes(1);
  });

  it('shows one step per call: the claim, the approve and the sale for USDS', () => {
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    expect(mocks.updates).toEqual([]);

    mocks.claim.calls = CLAIM_CALLS;
    rerender();
    expect(stepLabels()).toEqual(['Claim USDC', 'Approve USDC', 'Convert USDC USDS']);
    expect(mocks.updates.at(-1)!.partial.bundled).toBe(false);
    expect(mocks.updates.at(-1)!.sessionId).toBe(mocks.launched.at(-1)!.sessionId);
  });

  it('names both tokens on the sale step: Convert USDC to USDS (Figma 96)', () => {
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    mocks.claim.calls = CLAIM_CALLS;
    rerender();
    expect((mocks.updates.at(-1)!.partial.steps as unknown[]).at(-1)).toMatchObject({
      label: 'Convert',
      tokenSymbol: 'USDC',
      targetTokenSymbol: 'USDS'
    });
  });

  it('skips the approve step when the allowance covers the sale', () => {
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    mocks.claim.calls = [CLAIM_CALLS[0], CLAIM_CALLS[2]];
    rerender();
    expect(stepLabels()).toEqual(['Claim USDC', 'Convert USDC USDS']);
  });

  it('shows the steps as one bundle when the wallet batches them', () => {
    mocks.batch = true;
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    expect(mocks.claim.params?.batch).toBe(true);

    mocks.claim.calls = CLAIM_CALLS;
    mocks.claim.isBatch = true;
    rerender();
    expect(mocks.updates.at(-1)!.partial.bundled).toBe(true);
  });

  describe('minting to another address', () => {
    const OTHER = '0x00000000000000000000000000000000000b0b01';

    it("refuses the claim from a wallet that isn't the recipient", () => {
      const card = seedCctpClaim(OTHER);
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(card)).toBe(false);

      act(() => result.current.launch(card));
      expect(mocks.launched).toEqual([]);
      expect(mocks.claim.params?.enabled).toBe(false);
    });

    it('asks for no network switch for it', () => {
      mocks.walletChainId = 8453;
      mocks.canSwitchChain = false;
      const card = seedCctpClaim(OTHER);
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.actionHint(card)).toBeUndefined();
    });

    it('keeps the claim and its hint for the recipient', () => {
      const card = seedCctpClaim(mocks.address.toUpperCase().replace('0X', '0x'));
      const { result, rerender } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(card)).toBe(true);
      act(() => result.current.launch(card));
      expect(mocks.claim.params?.enabled).toBe(true);

      mocks.walletChainId = 8453;
      mocks.canSwitchChain = false;
      rerender();
      expect(result.current.actionHint(card)).toEqual({
        kind: 'switch-network',
        network: 'ethereum',
        safe: false
      });
    });
  });

  describe("sent to this wallet from another account's list", () => {
    const SENDER = '0x00000000000000000000000000000000005e7d01';
    const senderScope = pendingScopeKey({ account: SENDER, familyChainId: 1 });

    // The sender's entry, as its burn stored it in this browser.
    const seedIncoming = () => {
      const recipient = mocks.address;
      mocks.address = SENDER;
      seedCctpClaim(recipient);
      mocks.address = recipient;
      return pendingBridgeStore.getSnapshot(senderScope).find(entry => entry.id === '0xburn')!;
    };

    beforeEach(() => localStorage.removeItem(`bridgePending:v1:${senderScope}`));

    it("claims it for the recipient and records the claim in the sender's entry", () => {
      mocks.claim.ready = true;
      const card = seedIncoming();
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(card)).toBe(true);

      act(() => result.current.launchIn(senderScope, card));
      expect(mocks.claim.params).toMatchObject({
        enabled: true,
        routeData: ROUTE_DATA,
        account: mocks.address
      });
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.claim.execute).toHaveBeenCalledTimes(1);

      mocks.claim.params!.getCallbacks().onStart('0xclaim');
      const sent = pendingBridgeStore.getSnapshot(senderScope).find(entry => entry.id === card.id)!;
      expect(sent.actions).toEqual([
        { action: 'claim', txHash: '0xclaim', at: expect.any(Number), status: 'sent' }
      ]);
      expect(pendingBridgeStore.getSnapshot(scope())).toEqual([]);
    });

    it("isn't found in the wallet's own list", () => {
      const card = seedIncoming();
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card));
      expect(mocks.launched).toEqual([]);
    });

    it('is still refused to the sender', () => {
      const card = seedIncoming();
      mocks.address = SENDER;
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launchIn(senderScope, card));
      expect(mocks.launched).toEqual([]);
    });
  });

  it('leaves a native deposit to its own legs', () => {
    mocks.walletChainId = 8453;
    const card = seedReadyReplay();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    expect(mocks.claim.params?.enabled).toBe(false);
    expect(mocks.replayEnabled).toBe(true);
    expect(mocks.updates).toEqual([]);
  });
});
