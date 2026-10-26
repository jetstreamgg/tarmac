/**
 * @vitest-environment happy-dom
 */
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import type { ConvertOfferReader } from '../adapters/cctp/convert';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// A CCTP claim or convert sent as a wallet bundle has no hash until it mines: it is sent under the wallet's calls id, so a reload never offers it twice.

const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type LegsParams = {
  enabled: boolean;
  getCallbacks: () => TxCallbacks;
  onLegSent?: (hash: string, variables: { functionName: string }, context?: unknown) => void;
  onLegFailed?: (hash: string) => void;
  onLegPrompt?: (variables: { functionName: string }, context?: unknown) => (() => void) | undefined;
  onCallsSent?: (id: string, context?: unknown) => void;
};
type LegsMock = {
  params?: LegsParams;
  ready: boolean;
  execute: (context?: unknown) => void;
  dropCheck?: () => void;
  client?: ConvertOfferReader;
};
const legsResult = (legs: LegsMock) => ({
  calls: [],
  isBatch: false,
  ready: legs.ready,
  error: null,
  execute: legs.execute,
  reset: () => undefined,
  dropCheck: legs.dropCheck ?? (() => undefined),
  client: legs.client
});

const mocks = vi.hoisted(() => ({
  address: '',
  isSafe: false,
  modalOpen: true,
  launched: [] as TransactionConfig[],
  onError: (() => undefined) as (error: Error) => void,
  claim: { ready: true, execute: () => undefined } as LegsMock,
  convert: { ready: true, execute: () => undefined } as LegsMock
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: 1 }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }, { id: 8453 }]
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.isSafe,
  useSafeWalletStatus: () => (mocks.isSafe ? 'safe' : 'not-safe')
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => true }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: vi.fn(),
    txCallbacks: {
      onMutate: vi.fn(),
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: (error: Error) => mocks.onError(error)
    },
    txStatus: 'idle',
    isModalOpen: mocks.modalOpen,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: () => undefined
}));
vi.mock('./useOpStackReplayLegs', () => ({
  useOpStackReplayLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('./useArbitrumRedeemLegs', () => ({
  useArbitrumRedeemLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('./useCctpClaimLegs', () => ({
  CCTP_CLAIM_FUNCTION: 'receiveMessage',
  useCctpClaimLegs: (params: LegsParams) => {
    mocks.claim.params = params;
    return legsResult(mocks.claim);
  }
}));
vi.mock('./useCctpConvertLegs', () => ({
  useCctpConvertLegs: (params: LegsParams) => {
    mocks.convert.params = params;
    return legsResult(mocks.convert);
  }
}));
vi.mock('../adapters/mockAdapter', () => ({ runMockLegs: () => new Promise<string>(() => undefined) }));

const NOW = 1_800_000_000_000;
const ROUTE_DATA = { cctpMessage: '0xmessage', cctpAttestation: '0xattestation' };
const MINTED = 100n * 10n ** 6n;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const stored = () => pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;
const actionsOf = (action: string) => stored().actions.filter(done => done.action === action);

const seed = ({ claimed }: { claimed: boolean }) => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok' || resolved.route.kind !== 'cctp') throw new Error('no CCTP route');
  const ready = applyProgress(
    createPendingBridge({
      account: mocks.address,
      amount: 100n * 10n ** 18n,
      from: 'base',
      to: 'ethereum',
      route: resolved.route,
      txHash: '0xburn',
      now: NOW
    }),
    { kind: 'ready', nextAction: 'claim', routeData: ROUTE_DATA },
    NOW
  );
  pendingBridgeStore.upsert(
    scope(),
    claimed ? recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW }) : ready
  );
  return stored();
};

const confirm = () => act(() => mocks.launched.at(-1)!.onConfirm!());

// As the batch engine does: the wallet takes the bundle, then the run starts with no hash.
const bundleSent = (legs: LegsMock, context: unknown, id = '0xcalls') => {
  const callbacks = legs.params!.getCallbacks();
  act(() => {
    callbacks.onMutate(undefined);
    legs.params!.onCallsSent!(id, context);
    callbacks.onStart(undefined);
  });
  return callbacks;
};
const batchFailed = () => new Error('ERROR: Batch transaction failed');

describe('useDestinationActionLaunch: a CCTP action sent as a wallet bundle', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(7000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.isSafe = false;
    mocks.modalOpen = true;
    mocks.launched = [];
    mocks.claim = { ready: true, execute: vi.fn() };
    mocks.convert = { ready: true, execute: vi.fn() };
    mocks.onError = vi.fn();
  });

  describe.each([
    {
      action: 'claim' as const,
      legs: () => mocks.claim,
      claimed: false,
      // The claim run's context is what the engine hands back with the calls id.
      context: () => vi.mocked(mocks.claim.execute).mock.calls.at(-1)?.[0]
    },
    {
      action: 'convert' as const,
      legs: () => mocks.convert,
      claimed: true,
      context: () => ({ scope: scope(), bridgeId: '0xburn' })
    }
  ])('a bundled $action', ({ action, legs, claimed, context }) => {
    const start = () => {
      const card = seed({ claimed });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, action, MINTED));
      confirm();
      return { result, callbacks: bundleSent(legs(), context()) };
    };

    it('is sent under its calls id once the wallet takes it, so it is not offered again', () => {
      const { result } = start();
      expect(actionsOf(action)).toEqual([
        { action, txHash: '0xcalls', at: expect.any(Number), status: 'sent', bundle: true }
      ]);
      expect(result.current.canLaunch(stored(), action)).toBe(false);
    });

    it('is offered again once the bundle fails in this tab', () => {
      const { result, callbacks } = start();
      act(() => callbacks.onError(batchFailed(), '0xreverted'));
      expect(actionsOf(action)).toEqual([]);
      expect(result.current.canLaunch(stored(), action)).toBe(true);
    });

    it('stays sent when the wait fails without the bundle failing', () => {
      const { callbacks } = start();
      act(() => callbacks.onError(new Error('Timed out while waiting for transaction'), '0xreceive'));
      expect(actionsOf(action)).toMatchObject([{ txHash: '0xcalls', status: 'sent', bundle: true }]);
    });

    it('confirms under its first transaction, with the others the wallet ran apart', () => {
      const { callbacks } = start();
      act(() => callbacks.onSuccess('0xfirst', 7n, ['0xfirst', '0xsecond']));
      expect(actionsOf(action)).toEqual([
        { action, txHash: '0xfirst', at: expect.any(Number), bundleTxHashes: ['0xsecond'] }
      ]);
    });
  });

  it('records nothing for a bundle of another card', () => {
    const card = seed({ claimed: false });
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'claim'));
    confirm();
    bundleSent(mocks.claim, { scope: scope(), bridgeId: '0xother' });
    expect(actionsOf('claim')).toEqual([]);
  });

  // A Safe's run is recorded under its on-chain hash by the Safe tracker, never under a calls id.
  it.each([
    ['a run without its card', undefined],
    ['a Safe run', { scope: 'safe', bridgeId: '0xburn', safe: true }]
  ])('records nothing for %s', (_, context) => {
    const card = seed({ claimed: false });
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'claim'));
    confirm();
    const run = context && { ...context, scope: scope() };
    expect(() => bundleSent(mocks.claim, run)).not.toThrow();
    expect(actionsOf('claim')).toEqual([]);
  });
});
