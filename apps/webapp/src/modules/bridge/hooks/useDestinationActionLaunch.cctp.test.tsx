/**
 * @vitest-environment happy-dom
 */
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
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
  redeemEnabled: false
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }, { id: 8453 }]
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
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
    txStatus: 'idle',
    isModalOpen: true,
    isMinimized: false,
    activeSessionId: undefined,
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
