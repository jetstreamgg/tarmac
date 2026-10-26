/**
 * @vitest-environment happy-dom
 */
// A CCTP run whose swap mined and whose burn then failed must not leave the source balance stale.
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { cctpL2Contracts, TOKEN_MESSENGER_V2 } from '../adapters/cctp/contracts';
import { BASE_BURN_AMOUNT, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore } from '../store/pendingStore';
import type { BridgeFormModel } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';

const SENDER = getAddress(BASE_BURN_TX.from);
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n;
const BASE = 8453;
const { usds, usdc, psm3 } = cctpL2Contracts('base');

const mocks = vi.hoisted(() => ({
  launched: [] as TransactionConfig[],
  modalOpen: false,
  closeReset: undefined as undefined | ((onCleared?: () => void) => void),
  closeRefetch: undefined as undefined | (() => void),
  burnArgs: [] as { getCallbacks: () => TxCallbacks }[]
}));

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
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => false }));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: (reset: (onCleared?: () => void) => void, refetchReads?: () => void) => {
    mocks.closeReset = reset;
    mocks.closeRefetch = refetchReads;
  }
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: () => {},
    isModalOpen: mocks.modalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: mocks.modalOpen ? TxStatus.ERROR : TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('./usePendingScope', async () => {
  const { pendingScopeKey } = await import('../store/pendingStore');
  const { getAddress } = await import('viem');
  const { BASE_BURN_TX } = await import('../adapters/cctp/cctp.fixtures');
  const account = getAddress(BASE_BURN_TX.from);
  return {
    usePendingScope: () => ({
      account,
      familyChainId: 1,
      scope: pendingScopeKey({ account, familyChainId: 1 })
    })
  };
});
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
vi.mock('./useNativeDepositLegs', () => {
  const idle = {
    calls: [],
    maxFee: undefined,
    needsApprove: false,
    isBatch: false,
    ready: false,
    error: null,
    execute: vi.fn(),
    // A reset clears at once: its onCleared runs.
    reset: (onCleared?: () => void) => onCleared?.(),
    stop: () => {},
    refetchAllowance: () => {}
  };
  return { nativeDepositFunction: () => 'bridgeERC20To', useNativeDepositLegs: () => idle };
});
vi.mock('./useCctpBurnLegs', () => ({
  CCTP_BURN_FUNCTION: 'depositForBurn',
  useCctpBurnLegs: (args: { getCallbacks: () => TxCallbacks }) => {
    mocks.burnArgs.push(args);
    return {
      calls: [
        { to: usds, functionName: 'approve', args: [psm3, AMOUNT] },
        { to: psm3, functionName: 'swapExactIn' },
        { to: usdc, functionName: 'approve', args: [TOKEN_MESSENGER_V2, BASE_BURN_AMOUNT] },
        { to: TOKEN_MESSENGER_V2, functionName: 'depositForBurn' }
      ],
      isBatch: false,
      ready: true,
      error: null,
      execute: vi.fn(),
      reset: (onCleared?: () => void) => onCleared?.(),
      stop: vi.fn(),
      refetchAllowance: vi.fn()
    };
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

const form = (() => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: AMOUNT,
    facts: { cctp: { isOpen: true }, native: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return {
    amount: AMOUNT,
    from: 'base',
    to: 'ethereum',
    route: result.route,
    recipient: undefined,
    isConnected: true,
    reviewBlocked: false
  } as unknown as BridgeFormModel;
})();

// The two shapes the form's source balance reads take on Base.
const WAGMI_BALANCE_KEY = [
  'readContracts',
  { contracts: [{ chainId: BASE, address: usds, functionName: 'balanceOf', args: [SENDER] }] }
];
const TOKEN_BALANCES_KEY = ['token-balances', SENDER, { [BASE]: [usds, usdc] }];

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const fetches = new Map<string, ReturnType<typeof vi.fn>>();
  const seed = async (queryKey: unknown[]) => {
    const queryFn = vi.fn(async () => 40n * 10n ** 18n);
    fetches.set(JSON.stringify(queryKey), queryFn);
    await queryClient.prefetchQuery({ queryKey, queryFn });
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(() => useBridgeLaunch(form), { wrapper });
  // Refreshed: marked stale for the next read, or read again.
  const refreshed = (queryKey: unknown[]) =>
    !!queryClient.getQueryState(queryKey)?.isInvalidated ||
    fetches.get(JSON.stringify(queryKey))!.mock.calls.length > 1;
  return { view, seed, refreshed };
}

/** Confirm, then approve USDS, swap and approve USDC mine; the burn prompt opens. */
function runToBurn(view: ReturnType<typeof setup>['view']) {
  act(() => view.result.current.launch());
  mocks.modalOpen = true;
  view.rerender();
  act(() => mocks.launched.at(-1)!.onConfirm!());
  const callbacks = mocks.burnArgs.at(-1)!.getCallbacks();
  act(() => {
    callbacks.onMutate({ functionName: 'approve' } as never);
    callbacks.onStart('0x01');
    callbacks.onMutate({ functionName: 'swapExactIn' } as never);
    callbacks.onStart('0x02');
    callbacks.onMutate({ functionName: 'approve' } as never);
    callbacks.onStart('0x03');
    callbacks.onMutate({ functionName: 'depositForBurn' } as never);
  });
  return callbacks;
}

/** The user closes the failed modal. */
function close(view: ReturnType<typeof setup>['view']) {
  mocks.modalOpen = false;
  view.rerender();
  act(() => mocks.closeReset?.(mocks.closeRefetch));
}

describe('the source balance after a CCTP run that swapped but did not burn', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    localStorage.clear();
    const unsubscribe = pendingBridgeStore.subscribe(() => undefined);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    unsubscribe();
    Object.assign(mocks, { launched: [], modalOpen: false, burnArgs: [] });
  });

  // Control: the harness sees the refresh a finished run makes.
  it('refreshes the Base balance reads when the burn mines', async () => {
    const { view, seed, refreshed } = setup();
    await seed(WAGMI_BALANCE_KEY);
    await seed(TOKEN_BALANCES_KEY);
    const callbacks = runToBurn(view);
    act(() => {
      callbacks.onStart(BASE_BURN_TX.hash);
      callbacks.onSuccess(BASE_BURN_TX.hash, 1n);
    });
    expect(refreshed(WAGMI_BALANCE_KEY)).toBe(true);
    expect(refreshed(TOKEN_BALANCES_KEY)).toBe(true);
  });

  it('refreshes the Base balance reads when the burn is declined in the wallet', async () => {
    const { view, seed, refreshed } = setup();
    await seed(WAGMI_BALANCE_KEY);
    await seed(TOKEN_BALANCES_KEY);
    const callbacks = runToBurn(view);
    act(() =>
      callbacks.onError(Object.assign(new Error('User rejected the request.'), { code: 4001 }), '0x03')
    );
    close(view);
    // The swap moved USDS to USDC on Base: the form must not keep offering the pre-swap USDS.
    expect(refreshed(WAGMI_BALANCE_KEY)).toBe(true);
    expect(refreshed(TOKEN_BALANCES_KEY)).toBe(true);
  });

  it('refreshes the Base balance reads when the burn reverts', async () => {
    const { view, seed, refreshed } = setup();
    await seed(WAGMI_BALANCE_KEY);
    await seed(TOKEN_BALANCES_KEY);
    const callbacks = runToBurn(view);
    act(() => {
      callbacks.onStart(BASE_BURN_TX.hash);
      callbacks.onError(new TransactionRevertedError(), BASE_BURN_TX.hash);
    });
    close(view);
    expect(refreshed(WAGMI_BALANCE_KEY)).toBe(true);
    expect(refreshed(TOKEN_BALANCES_KEY)).toBe(true);
  });
});
