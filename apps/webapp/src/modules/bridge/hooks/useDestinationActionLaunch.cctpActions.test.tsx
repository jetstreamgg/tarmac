/**
 * @vitest-environment happy-dom
 */
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// A CCTP claim or convert signs other legs around its own: only the action's leg records it, and a later leg's failure never undoes an action that mined.

const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type LegsParams = { enabled: boolean; getCallbacks: () => TxCallbacks };
type LegsMock = { params?: LegsParams; ready: boolean; execute: () => void };
const legsResult = (legs: LegsMock) => ({
  calls: [],
  isBatch: false,
  ready: legs.ready,
  error: null,
  execute: legs.execute,
  reset: () => undefined
});

const mocks = vi.hoisted(() => ({
  address: '',
  isSafe: false,
  launched: [] as TransactionConfig[],
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
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => false }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: vi.fn(),
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: 'idle',
    isModalOpen: true,
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
const leg = (callbacks: TxCallbacks, functionName: string, hash: string) => {
  callbacks.onMutate({ functionName });
  callbacks.onStart(hash);
};

describe('useDestinationActionLaunch: the legs around a CCTP action', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(6000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.isSafe = false;
    mocks.launched = [];
    mocks.claim = { ready: true, execute: vi.fn() };
    mocks.convert = { ready: true, execute: vi.fn() };
  });

  describe('a convert after its approve', () => {
    it('is not recorded by the approve, so a sale rejected after it can be sent again', () => {
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      confirm();
      const callbacks = mocks.convert.params!.getCallbacks();
      leg(callbacks, 'approve', '0xapprove');
      expect(actionsOf('convert')).toEqual([]);
      callbacks.onMutate({ functionName: 'sellGem' });
      callbacks.onError(new Error('User rejected the request.'));
      expect(actionsOf('convert')).toEqual([]);
      expect(result.current.canLaunch(stored(), 'convert')).toBe(true);
    });

    it('is recorded by its sale, also from a Safe', () => {
      mocks.isSafe = true;
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      confirm();
      const callbacks = mocks.convert.params!.getCallbacks();
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      expect(actionsOf('convert')).toEqual([
        { action: 'convert', txHash: '0xsell', at: expect.any(Number), status: 'sent', safe: true }
      ]);
    });
  });

  describe('a claim followed by its approve and sale', () => {
    it('stays claimed under the receive hash when the sale reverts', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onError(new TransactionRevertedError(), '0xsell');
      expect(actionsOf('claim')).toEqual([{ action: 'claim', txHash: '0xreceive', at: expect.any(Number) }]);
      expect(stored().status).toBe('claimed');
      expect(result.current.canLaunch(stored(), 'claim')).toBe(false);
    });

    it('keeps the claim sent from a Safe when the sale reverts, for the tracker to settle', () => {
      mocks.isSafe = true;
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xsafe-receive');
      leg(callbacks, 'sellGem', '0xsafe-sell');
      callbacks.onError(new TransactionRevertedError(), '0xsell-on-chain');
      expect(actionsOf('claim')).toEqual([
        { action: 'claim', txHash: '0xsafe-receive', at: expect.any(Number), status: 'sent', safe: true }
      ]);
    });
  });
});
