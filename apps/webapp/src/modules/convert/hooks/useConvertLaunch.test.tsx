import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  launchMock: vi.fn(),
  updateMock: vi.fn(),
  isModalOpen: false,
  txStatus: 'idle',
  txCallbacks: {
    onMutate: vi.fn(),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  },
  // Engine state the mock returns + the params it captured.
  engineParams: undefined as Record<string, unknown> | undefined,
  execute: vi.fn(),
  mutatePocketBalance: vi.fn(),
  needsAllowance: false,
  prepared: true,
  isLoading: false,
  disabledReason: undefined as string | undefined,
  targetAmount: 0n as bigint
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [
      { id: 1, name: 'Ethereum' },
      { id: 8453, name: 'Base' }
    ]
  };
});

vi.mock('@/hooks/shared/useNetworkFee', () => ({
  // The fee row is read-only and network-backed; these tests render without a
  // WagmiProvider, so stub it to the un-resolved state the row falls back on.
  useNetworkFee: () => ({ data: undefined, isLoading: false, error: null, mutate: () => {}, dataSources: [] })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launchMock,
    updateModalContent: h.updateMock,
    isModalOpen: h.isModalOpen,
    txStatus: h.txStatus,
    txCallbacks: h.txCallbacks
  })
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, vi.fn()]
}));

vi.mock('./usePsmConversion', () => ({
  usePsmConversion: (params: Record<string, unknown>) => {
    h.engineParams = params;
    const direction = params.direction as string;
    const [originSymbol, targetSymbol] = direction === 'USDC_TO_USDS' ? ['USDC', 'USDS'] : ['USDS', 'USDC'];
    return {
      direction,
      originToken: { symbol: originSymbol },
      targetToken: { symbol: targetSymbol },
      targetAmount: h.targetAmount,
      needsAllowance: h.needsAllowance,
      prepared: h.prepared,
      isLoading: h.isLoading,
      disabledReason: h.disabledReason,
      execute: h.execute,
      mutatePocketBalance: h.mutatePocketBalance
    };
  }
}));

import { useConvertLaunch } from './useConvertLaunch';

const AMOUNT_USDS = parseUnits('100', 18);

beforeEach(() => {
  vi.clearAllMocks();
  h.engineParams = undefined;
  h.isModalOpen = false;
  h.needsAllowance = false;
  h.prepared = true;
  h.isLoading = false;
  h.disabledReason = undefined;
  h.targetAmount = parseUnits('100', 6);
});

afterEach(cleanup);

describe('useConvertLaunch', () => {
  it('wires the engine with the txCallbacks, referral code and direction/amount', () => {
    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));

    expect(h.engineParams).toMatchObject({
      direction: 'USDS_TO_USDC',
      amount: AMOUNT_USDS,
      shouldUseBatch: true,
      onMutate: h.txCallbacks.onMutate,
      onStart: h.txCallbacks.onStart,
      onSuccess: h.txCallbacks.onSuccess,
      onError: h.txCallbacks.onError
    });
    expect(h.engineParams).toHaveProperty('referralCode');
  });

  it('labels a two-step approve → convert flow when allowance is needed', () => {
    h.needsAllowance = true;
    const { result } = renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));
    expect(result.current.steps).toEqual(['Approve USDS', 'Convert USDS to USDC']);
  });

  it('collapses to a single convert step when allowance covers the amount', () => {
    const { result } = renderHook(() =>
      useConvertLaunch({ direction: 'USDC_TO_USDS', amount: parseUnits('100', 6) })
    );
    expect(result.current.steps).toEqual(['Convert USDC to USDS']);
  });

  it('launches the review modal with the frozen config shape and convert analytics', () => {
    const { result } = renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));

    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config).toMatchObject({
      title: 'Review conversion',
      transactionTitle: 'Confirm in the wallet',
      confirmLabel: 'Confirm',
      confirmDisabled: false,
      steps: ['Convert USDS to USDC'],
      toast: {
        loading: 'Converting 100 USDS',
        success: 'USDC converted!',
        error: 'Conversion failed'
      },
      analytics: {
        widgetName: 'convert',
        flow: 'usds-to-usdc',
        action: 'convert',
        data: { module: 'convert', originToken: 'USDS', targetToken: 'USDC', amount: 100 }
      }
    });
    expect(typeof config.sessionId).toBe('string');
    expect(config.transactionContent).toBeTruthy();
  });

  it('onConfirm fires the live engine execute; onSuccess refetches engine reads then the caller', () => {
    const callerSuccess = vi.fn();
    const { result } = renderHook(() =>
      useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS, onSuccess: callerSuccess })
    );

    act(() => result.current.launch());
    const config = h.launchMock.mock.calls[0][0];

    config.onConfirm();
    expect(h.execute).toHaveBeenCalledTimes(1);

    config.onSuccess();
    expect(h.mutatePocketBalance).toHaveBeenCalledTimes(1);
    expect(callerSuccess).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['zero amount', () => ({ amount: 0n }), {}],
    ['engine guard', () => ({}), { disabledReason: 'insufficient_liquidity' }],
    ['not prepared', () => ({}), { prepared: false }]
  ] as const)('disables confirm on %s', (_label, paramsOverride, engineOverride) => {
    Object.assign(h, engineOverride);
    const { result } = renderHook(() =>
      useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS, ...paramsOverride() })
    );

    act(() => result.current.launch());
    expect(h.launchMock.mock.calls[0][0].confirmDisabled).toBe(true);
  });

  it('pushes live updates to the open modal, scoped by sessionId', () => {
    h.isModalOpen = true;
    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));

    expect(h.updateMock).toHaveBeenCalled();
    const [sessionId, partial] = h.updateMock.mock.calls.at(-1)!;
    expect(typeof sessionId).toBe('string');
    expect(partial).toMatchObject({ confirmDisabled: false, steps: ['Convert USDS to USDC'] });
  });

  it('freezes modal content once the transaction leaves the review screen', () => {
    // Post-confirm, the page resets the form (amount → 0); pushing that state
    // would blank the executed amounts on the wallet/status screens.
    h.isModalOpen = true;
    h.txStatus = 'success';
    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: 0n }));

    expect(h.updateMock).not.toHaveBeenCalled();
    h.txStatus = 'idle';
  });
});
