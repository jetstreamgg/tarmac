/**
 * @vitest-environment happy-dom
 */
// A close while a leg before the bridge one is still out refreshes the source reads once that leg lands.
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore } from '../store/pendingStore';
import type { BridgeFormModel } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';

const AMOUNT = 2n * 10n ** 18n;

// Each engine's reset, like the sequential flow's: with a write out it waits for it before clearing.
const mocks = vi.hoisted(() => {
  const engine = () => ({
    args: [] as { getCallbacks: () => TxCallbacks }[],
    writeOut: false,
    detached: undefined as undefined | { onCleared?: () => void },
    refetchAllowance: vi.fn()
  });
  return {
    launched: [] as TransactionConfig[],
    modalOpen: false,
    burn: engine(),
    deposit: engine()
  };
});
type Engine = typeof mocks.burn;

const legs = (engine: Engine, calls: { functionName: string }[]) => ({
  calls,
  maxFee: undefined,
  needsApprove: true,
  isBatch: false,
  ready: true,
  error: null,
  execute: vi.fn(),
  reset: (onCleared?: () => void) => {
    if (engine.writeOut) engine.detached = { onCleared };
    else onCleared?.();
  },
  stop: vi.fn(),
  refetchAllowance: engine.refetchAllowance
});

/** The write out lands: the engine clears and runs the onCleared of its latest reset. */
function settle(engine: Engine) {
  engine.writeOut = false;
  const detached = engine.detached;
  engine.detached = undefined;
  detached?.onCleared?.();
}

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  usePublicClient: () => ({ getTransactionReceipt: async () => undefined })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useSafeWalletStatus: () => 'not-safe',
  useNetworkFee: () => ({ data: undefined }),
  useTokenBalance: () => ({ data: undefined, isLoading: false })
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: () => false,
  useBatchSupportPending: () => false
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: () => {},
    isModalOpen: mocks.modalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    // A leg waits for its receipt while the modal is open; a close returns the status to IDLE.
    txStatus: mocks.modalOpen ? TxStatus.LOADING : TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('./usePendingScope', async () => {
  const { pendingScopeKey } = await import('../store/pendingStore');
  const account = '0x00000000000000000000000000000000000000a1';
  return {
    usePendingScope: () => ({
      account,
      familyChainId: 1,
      scope: pendingScopeKey({ account, familyChainId: 1 })
    })
  };
});
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
vi.mock('./useNativeDepositLegs', () => ({
  nativeDepositFunction: () => 'bridgeERC20To',
  useNativeDepositLegs: (args: { getCallbacks: () => TxCallbacks }) => {
    mocks.deposit.args.push(args);
    return legs(mocks.deposit, [{ functionName: 'approve' }, { functionName: 'bridgeERC20To' }]);
  }
}));
vi.mock('./useCctpBurnLegs', () => ({
  CCTP_BURN_FUNCTION: 'depositForBurn',
  useCctpBurnLegs: (args: { getCallbacks: () => TxCallbacks }) => {
    mocks.burn.args.push(args);
    return legs(mocks.burn, [
      { functionName: 'approve' },
      { functionName: 'swapExactIn' },
      { functionName: 'approve' },
      { functionName: 'depositForBurn' }
    ]);
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

const formFor = (from: 'base' | 'ethereum', to: 'base' | 'ethereum') => {
  const result = resolveBridgeRoute({
    from,
    to,
    amount: AMOUNT,
    facts: { cctp: { isOpen: true }, native: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return {
    amount: AMOUNT,
    from,
    to,
    route: result.route,
    recipient: undefined,
    isConnected: true,
    reviewBlocked: false
  } as unknown as BridgeFormModel;
};

const CASES = [
  {
    name: 'a CCTP burn from Base',
    form: formFor('base', 'ethereum'),
    engine: () => mocks.burn,
    chainId: 8453
  },
  {
    name: 'a native deposit from Ethereum',
    form: formFor('ethereum', 'base'),
    engine: () => mocks.deposit,
    chainId: 1
  }
];

describe('the source reads after a close with a leg still out', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    localStorage.clear();
    const unsubscribe = pendingBridgeStore.subscribe(() => undefined);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    unsubscribe();
    for (const engine of [mocks.burn, mocks.deposit])
      Object.assign(engine, { args: [], writeOut: false, detached: undefined });
    vi.clearAllMocks();
    Object.assign(mocks, { launched: [], modalOpen: false });
  });

  it.each(CASES)(
    '$name refreshes them once the approve the close left out has mined',
    ({ form, engine, chainId }) => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const view = renderHook(() => useBridgeLaunch(form), { wrapper });

      // Confirm; the approve is signed and waits for its receipt.
      act(() => view.result.current.launch());
      mocks.modalOpen = true;
      view.rerender();
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = engine().args.at(-1)!.getCallbacks();
      act(() => {
        callbacks.onMutate({ functionName: 'approve' } as never);
        callbacks.onStart('0x01');
      });
      engine().writeOut = true;

      // The user closes the modal before the approve mines.
      mocks.modalOpen = false;
      view.rerender();
      const refetchesAtClose = engine().refetchAllowance.mock.calls.length;
      const invalidatesAtClose = invalidate.mock.calls.length;

      // The approve mines: the allowance and the source balances must be read again now.
      act(() => settle(engine()));
      expect(engine().refetchAllowance.mock.calls.length).toBeGreaterThan(refetchesAtClose);
      const sourceBalanceKey = [
        'token-balances',
        '0x00000000000000000000000000000000000000a1',
        { [chainId]: ['0x00000000000000000000000000000000000000b1'] }
      ];
      const refreshedSource = invalidate.mock.calls
        .slice(invalidatesAtClose)
        .some(([filters]) =>
          filters?.predicate ? filters.predicate({ queryKey: sourceBalanceKey } as never) : false
        );
      expect(refreshedSource).toBe(true);
    }
  );
});
