/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, matchQuery } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { readsBalanceOn } from './balanceQueries';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

type LegParams = { enabled: boolean; getCallbacks: () => TxCallbacks };
type Legs = {
  params: undefined | LegParams;
  calls: { functionName: string }[];
  isBatch: boolean;
  ready: boolean;
  error: Error | null;
  execute: () => void;
  reset: () => void;
};

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 1,
  launched: [] as TransactionConfig[],
  claim: undefined as unknown as Legs,
  convert: undefined as unknown as Legs
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
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => false }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: () => undefined,
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
const legsOf = (legs: Legs, params: LegParams) => {
  legs.params = params;
  const { calls, isBatch, ready, error, execute, reset } = legs;
  return { calls, isBatch, ready, error, execute, reset };
};
vi.mock('./useCctpClaimLegs', () => ({
  CCTP_CLAIM_FUNCTION: 'receiveMessage',
  useCctpClaimLegs: (params: LegParams) => legsOf(mocks.claim, params)
}));
vi.mock('./useCctpConvertLegs', () => ({
  useCctpConvertLegs: (params: LegParams) => legsOf(mocks.convert, params)
}));
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: () => new Promise<string>(() => undefined)
}));

const NOW = 1_800_000_000_000;
const ETHEREUM = 1;
const MINTED = 100n * 10n ** 6n;
const ROUTE_DATA = { cctpMessage: '0xmessage', cctpAttestation: '0xattestation' };
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });

const freshLegs = (): Legs => ({
  params: undefined,
  calls: [],
  isBatch: false,
  ready: true,
  error: null,
  execute: vi.fn(),
  reset: vi.fn()
});

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
  return pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;
};

// The two balance key shapes `readsBalanceOn` recognises, as the bridge form reads them on Ethereum.
const WAGMI_BALANCE_KEY = [
  'readContracts',
  { contracts: [{ chainId: ETHEREUM, functionName: 'balanceOf', address: '0xusds' }] }
];
const tokenBalancesKey = () => ['token-balances', mocks.address, { [ETHEREUM]: [{ symbol: 'USDS' }] }];

const render = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(WAGMI_BALANCE_KEY, [100n]);
  queryClient.setQueryData(tokenBalancesKey(), []);
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(() => useDestinationActionLaunch(), { wrapper });
  return { ...view, queryClient, invalidate };
};

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

const expectDestinationBalancesInvalidated = ({
  queryClient,
  invalidate
}: Pick<ReturnType<typeof render>, 'queryClient' | 'invalidate'>) => {
  for (const queryKey of [WAGMI_BALANCE_KEY, tokenBalancesKey()]) {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true })!;
    // Sanity: the fake query really is what `readsBalanceOn(1)` targets.
    expect(readsBalanceOn(ETHEREUM)(query)).toBe(true);
    const matched = invalidate.mock.calls.some(([filters]) => !filters || matchQuery(filters, query));
    expect(
      matched,
      `invalidateQueries was never called with filters matching the Ethereum balance query ${JSON.stringify(
        queryKey,
        (_, v) => (typeof v === 'bigint' ? v.toString() : v)
      )} (calls: ${invalidate.mock.calls.length})`
    ).toBe(true);
    expect(queryClient.getQueryState(queryKey)?.isInvalidated, 'destination balance query left fresh').toBe(
      true
    );
  }
};

describe('useDestinationActionLaunch: destination balances after the action confirms', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(7000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.walletChainId = 1;
    mocks.launched = [];
    mocks.claim = freshLegs();
    mocks.convert = freshLegs();
  });

  it('invalidates the Ethereum balances once a CCTP claim confirms', async () => {
    const card = seed({ claimed: false });
    const view = render();
    act(() => view.result.current.launch(card));
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.claim.execute).toHaveBeenCalledTimes(1);

    const callbacks = mocks.claim.params!.getCallbacks();
    act(() => callbacks.onStart('0xclaim'));
    act(() => callbacks.onSuccess('0xclaim'));
    await settle();

    // The claim was recorded: the bridge is settled, so the tracker will never refresh it on arrival.
    const entry = pendingBridgeStore.getSnapshot(scope()).find(bridge => bridge.id === card.id)!;
    expect(entry.status).toBe('claimed');
    expectDestinationBalancesInvalidated(view);
  });

  it('invalidates the Ethereum balances once the follow-up convert to USDS confirms', async () => {
    const card = seed({ claimed: true });
    const view = render();
    act(() => view.result.current.launch(card, 'convert', MINTED));
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.convert.execute).toHaveBeenCalledTimes(1);

    const callbacks = mocks.convert.params!.getCallbacks();
    act(() => callbacks.onStart('0xsell'));
    act(() => callbacks.onSuccess('0xsell'));
    await settle();

    const entry = pendingBridgeStore.getSnapshot(scope()).find(bridge => bridge.id === card.id)!;
    expect(entry.actions.filter(a => a.action === 'convert')).toEqual([
      { action: 'convert', txHash: '0xsell', at: expect.any(Number) }
    ]);
    expectDestinationBalancesInvalidated(view);
  });
});
