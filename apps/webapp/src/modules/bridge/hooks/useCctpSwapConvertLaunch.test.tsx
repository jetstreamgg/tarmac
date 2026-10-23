/**
 * @vitest-environment happy-dom
 */
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingScopeKey } from '../store/pendingStore';
import { useCctpSwapConvertLaunch } from './useCctpSwapConvertLaunch';

const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type ConvertParams = {
  enabled: boolean;
  swap?: UnfinishedCctpSwap;
  scope?: string;
  amount?: bigint;
  chainId?: number;
  account?: string;
  batch?: boolean;
  getCallbacks: () => TxCallbacks;
};

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 8453,
  modalOpen: true,
  launched: [] as TransactionConfig[],
  updates: [] as { sessionId: string; partial: Record<string, unknown> }[],
  modal: undefined as undefined | TxCallbacks,
  convert: {
    params: undefined as undefined | ConvertParams,
    calls: [] as { functionName: string }[],
    isBatch: false,
    ready: false,
    error: null as Error | null,
    execute: (() => undefined) as () => void,
    reset: (() => undefined) as () => void
  }
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
    updateModalContent: (sessionId: string, partial: Record<string, unknown>) =>
      mocks.updates.push({ sessionId, partial }),
    txCallbacks: mocks.modal,
    txStatus: 'idle',
    isModalOpen: mocks.modalOpen,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: () => undefined
}));
vi.mock('./useCctpConvertLegs', () => ({
  CCTP_L2_CONVERT_FUNCTION: 'swapExactIn',
  useCctpConvertLegs: (params: ConvertParams) => {
    mocks.convert.params = params;
    const { calls, isBatch, ready, error, execute, reset } = mocks.convert;
    return { calls, isBatch, ready, error, execute, reset };
  }
}));

const USDC = 250n * 10n ** 6n;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a',
  network: 'base',
  usdcAmount: USDC,
  recipient: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  at: 1
};
const seed = () => cctpSwapStore.record(scope(), SWAP);
const kept = () => cctpSwapStore.getSnapshot(scope()).find(swap => swap.swapTxHash === '0x5a');

const modalCallbacks = () => ({
  onMutate: vi.fn(),
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn()
});

describe('useCctpSwapConvertLaunch', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    accountSeq += 1;
    mocks.address = `0x${accountSeq.toString(16).padStart(40, '0')}`;
    mocks.walletChainId = 8453;
    mocks.modalOpen = true;
    mocks.launched = [];
    mocks.updates = [];
    mocks.modal = modalCallbacks();
    Object.assign(mocks.convert, {
      params: undefined,
      calls: [],
      isBatch: false,
      ready: false,
      error: null,
      execute: () => undefined,
      reset: () => undefined
    });
    seed();
  });

  it("opens the review of the swap's whole USDC on its L2, on that network", () => {
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    expect(mocks.launched).toHaveLength(1);
    expect(mocks.launched[0]).toMatchObject({
      title: 'Review conversion',
      transactionTitle: 'Review conversion',
      confirmLabel: 'Confirm',
      supportedChainIds: [8453],
      chainGuardReason: 'launch-chain',
      usdValue: 250
    });
    expect(mocks.convert.params).toMatchObject({
      enabled: true,
      swap: SWAP,
      scope: scope(),
      amount: USDC,
      chainId: 8453,
      account: mocks.address
    });
  });

  it('builds no legs off the L2, so the modal switches the wallet first', () => {
    mocks.walletChainId = 1;
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    expect(mocks.launched).toHaveLength(1);
    expect(mocks.convert.params?.enabled).toBe(false);
  });

  it("opens nothing for a network the app can't reach", () => {
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch({ ...SWAP, network: 'optimism' }));
    expect(mocks.launched).toEqual([]);
    expect(mocks.convert.params?.enabled).toBe(false);
  });

  it('sends on Confirm once the legs are ready, and drops the card once the convert succeeds', () => {
    const execute = vi.fn();
    mocks.convert.execute = execute;
    const { result, rerender } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    act(() => mocks.launched[0].onConfirm?.());
    expect(execute).not.toHaveBeenCalled();
    mocks.convert.ready = true;
    rerender();
    expect(execute).toHaveBeenCalledTimes(1);

    const callbacks = mocks.convert.params!.getCallbacks();
    act(() => callbacks.onSuccess('0xc0', 5n));
    expect(kept()).toBeUndefined();
    expect(mocks.modal!.onSuccess).toHaveBeenCalledWith('0xc0', 5n);
  });

  it('reports a failed leg build to the modal on Confirm', () => {
    const error = new Error('simulation failed');
    mocks.convert.error = error;
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    act(() => mocks.launched[0].onConfirm?.());
    expect(mocks.modal!.onError).toHaveBeenCalledWith(error, '');
  });

  it('sends nothing once the modal closed before the legs were ready', () => {
    const execute = vi.fn();
    mocks.convert.execute = execute;
    const { result, rerender } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    act(() => mocks.launched[0].onConfirm?.());
    mocks.modalOpen = false;
    rerender();
    mocks.convert.ready = true;
    rerender();
    expect(execute).not.toHaveBeenCalled();
  });

  it('shows the card again when its bundle reverts, only while the bundle is still its convert', () => {
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    act(() => mocks.launched[0].onConfirm?.());
    const callbacks = mocks.convert.params!.getCallbacks();
    // The legs link the bundle's calls id before the wallet accepts it.
    cctpSwapStore.markConvert(scope(), '0x5a', '0xb1');
    act(() => callbacks.onStart(undefined));
    act(() => callbacks.onError(new TransactionRevertedError(), '0xbundle'));
    expect(kept()?.convert).toBeUndefined();

    act(() => mocks.launched[0].onConfirm?.());
    const again = mocks.convert.params!.getCallbacks();
    cctpSwapStore.markConvert(scope(), '0x5a', '0xb2');
    act(() => again.onStart(undefined));
    // Another window's convert took over before this bundle failed.
    cctpSwapStore.markConvert(scope(), '0x5a', '0xc3');
    act(() => again.onError(new TransactionRevertedError(), '0xbundle'));
    expect(kept()?.convert).toBe('0xc3');
  });

  it('keeps the link when a bundle fails without reverting', () => {
    const { result } = renderHook(() => useCctpSwapConvertLaunch());
    act(() => result.current.launch(SWAP));
    act(() => mocks.launched[0].onConfirm?.());
    const callbacks = mocks.convert.params!.getCallbacks();
    cctpSwapStore.markConvert(scope(), '0x5a', '0xb1');
    act(() => callbacks.onStart(undefined));
    act(() => callbacks.onError(new Error('RPC down'), undefined));
    expect(kept()?.convert).toBe('0xb1');
  });
});
