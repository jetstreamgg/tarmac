/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useBridgeForm } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';

// Harness copied from useBridgeLaunch.test.tsx: the deposit legs and the transaction context are mocked.
const SENDER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const ONE = 10n ** 18n;

const mocks = vi.hoisted(() => ({
  isModalOpen: false,
  launched: [] as TransactionConfig[],
  updates: [] as Partial<TransactionConfig>[],
  onError: vi.fn(),
  onSuccess: vi.fn(),
  refetchAllowance: vi.fn(),
  legs: [] as { names: string[]; getCallbacks: () => TxCallbacks }[],
  deposit: {
    ready: true,
    needsApprove: true,
    maxFee: undefined as bigint | undefined,
    error: null as Error | null,
    calls: [{ to: '0xapprove' }, { to: '0xdeposit' }] as unknown[],
    execute: vi.fn(),
    args: [] as {
      enabled: boolean;
      to: string;
      chainId: number | undefined;
      getCallbacks: () => TxCallbacks;
    }[]
  }
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({ isConnected: true, address: SENDER, connector: { id: 'injected' } }),
  useChainId: () => 1,
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  usePublicClient: () => undefined,
  useReadContract: () => ({ status: 'success', data: 1n })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => 1,
  useNetworkFee: () => ({ data: { formatted: '$0.42' } }),
  useTokenBalance: () => ({ data: { value: 10n * ONE }, isLoading: false })
}));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => false }));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: (_id: string, patch: Partial<TransactionConfig>) => mocks.updates.push(patch),
    isModalOpen: mocks.isModalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: mocks.onSuccess, onError: mocks.onError },
    txStatus: TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('@/hooks/ui/useAppChainId', () => ({ useAppChainId: () => 1 }));
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: (names: string[], getCallbacks: () => TxCallbacks) => {
    mocks.legs.push({ names, getCallbacks });
    return new Promise<string>(() => undefined);
  }
}));
// The CCTP burn engine stays idle on these routes.
vi.mock('./useCctpBurnLegs', () => {
  const idle = {
    calls: [],
    needsApprove: false,
    isBatch: false,
    ready: false,
    error: null,
    execute: () => {},
    reset: () => {},
    stop: () => {},
    refetchAllowance: () => {}
  };
  return { CCTP_BURN_FUNCTION: 'depositForBurn', useCctpBurnLegs: () => idle };
});
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));
vi.mock('./useNativeDepositLegs', () => ({
  nativeDepositFunction: (to: string) =>
    to === 'arbitrum' ? 'outboundTransferCustomRefund' : 'bridgeERC20To',
  useNativeDepositLegs: (args: (typeof mocks.deposit.args)[number]) => {
    mocks.deposit.args.push(args);
    const { ready, needsApprove, maxFee, error, execute, calls } = mocks.deposit;
    return {
      calls,
      ready,
      needsApprove,
      maxFee,
      error,
      execute,
      reset: vi.fn(),
      stop: vi.fn(),
      refetchAllowance: mocks.refetchAllowance
    };
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

// Not a Safe: the Safe service answers 404 for the sender.
const fetchMock = vi.fn(() =>
  Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}) } as Response)
);

function renderBridge() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    () => {
      const form = useBridgeForm();
      return { form, ...useBridgeLaunch(form) };
    },
    { wrapper }
  );
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

describe('useBridgeLaunch: Retry after the approve mined and the deposit simulation failed', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(mocks, { isModalOpen: true, launched: [], updates: [], legs: [] });
    Object.assign(mocks.deposit, {
      ready: true,
      needsApprove: true,
      maxFee: undefined,
      error: null,
      calls: [{ to: '0xapprove' }, { to: '0xdeposit' }],
      args: []
    });
    mocks.deposit.execute.mockClear();
    mocks.onError.mockClear();
    mocks.onSuccess.mockClear();
    mocks.refetchAllowance.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it('refuses with the simulation error and sends nothing until the deposit is prepared again', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    act(() => view.result.current.form.selectTo('arbitrum'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.deposit.execute).toHaveBeenCalledTimes(1);

    // The approve mines, then the deposit leg's simulation fails.
    const callbacks = mocks.deposit.args.at(-1)!.getCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onStart('0xarbapprove');
    const simulationError = new Error('HTTP request failed.');
    act(() => callbacks.onError(simulationError, ''));
    Object.assign(mocks.deposit, { ready: false, error: simulationError });
    view.rerender();
    await settle();
    const errorsBeforeRetry = mocks.onError.mock.calls.length;

    // TransactionContext.handleRetry calls onConfirm when the flow has no onRetry.
    act(() => mocks.launched.at(-1)!.onConfirm!());

    const retryErrors = mocks.onError.mock.calls
      .slice(errorsBeforeRetry)
      .map(([error]) => (error as Error).message);
    expect(retryErrors).toEqual(['Something went wrong preparing the transaction. Please try again.']);
    expect(mocks.deposit.execute).toHaveBeenCalledTimes(1);

    // Once the simulation recovers, Retry reaches the legs.
    Object.assign(mocks.deposit, { ready: true, error: null });
    view.rerender();
    await settle();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.deposit.execute).toHaveBeenCalledTimes(2);
  });
});
