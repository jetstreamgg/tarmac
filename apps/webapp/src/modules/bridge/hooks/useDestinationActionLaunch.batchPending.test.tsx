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
  batchPending?: boolean;
  getCallbacks: () => TxCallbacks;
};

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 1,
  canSwitchChain: true,
  batch: false,
  safeStatus: 'checking' as 'checking' | 'not-safe' | 'safe' | 'unknown',
  sentWithBatch: [] as (boolean | undefined)[],
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
  useSafeWalletStatus: () => mocks.safeStatus,
  useIsBatchSupported: () => ({ data: true, isLoading: false })
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [mocks.batch] }));
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
    // As useBridgeCallLegs: not ready while the batch decision is out.
    return { calls, isBatch, ready: ready && !params.batchPending, error, execute, reset };
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

const seedCctpClaim = () => {
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
    now: NOW
  });
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'claim', routeData: ROUTE_DATA }, NOW)
  );
  return pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;
};

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));
beforeEach(() => {
  mocks.address = `0x${(5000 + ++accountSeq).toString(16).padStart(40, '0')}`;
  mocks.launched = [];
  mocks.updates = [];
  mocks.sentWithBatch = [];
  mocks.claim.calls = CLAIM_CALLS;
  // The sequential legs prepare as soon as they are built, before the wallet's Safe read answers.
  mocks.claim.ready = true;
  mocks.claim.execute = () => mocks.sentWithBatch.push(mocks.claim.params?.batch);
});

describe('useDestinationActionLaunch: a batch wallet whose Safe read is still out', () => {
  it('sends its Ethereum claim as one bundle once the read answers, never leg by leg', () => {
    mocks.batch = true;
    // The per-chain Safe read is cold right after the switch to Ethereum.
    mocks.safeStatus = 'checking';
    const card = seedCctpClaim();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card));
    expect(mocks.launched.at(-1)?.skipReview).toBe(true);
    // The modal fires onConfirm itself on mount (TransactionModal skipReview).
    act(() => mocks.launched.at(-1)!.onConfirm!());
    rerender();

    expect(mocks.sentWithBatch).toEqual([]);

    mocks.safeStatus = 'not-safe';
    rerender();
    rerender();

    expect(mocks.sentWithBatch).toEqual([true]);
  });
});
