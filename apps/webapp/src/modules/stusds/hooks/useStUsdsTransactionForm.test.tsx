import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { parseUnits } from 'viem';

i18n.load('en', {});
i18n.activate('en');

const POSITION = parseUnits('1000', 18);
const NATIVE_MAX = parseUnits('600', 18);

const h = vi.hoisted(() => ({
  stUsdsData: undefined as Record<string, unknown> | undefined,
  withdrawBalances: undefined as Record<string, unknown> | undefined,
  selectedProvider: 'native',
  selectionQuote: undefined as Record<string, unknown> | undefined,
  // When set, useDebounce returns this instead of the live value — simulates
  // the settle window after an amount change.
  debounceLagged: undefined as bigint | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => ({ isConnected: true })
  };
});

// The flag-driven max under test reads `available`, which the form derives from
// these reads — only the data layer is stubbed, the derivation stays real.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useDebounce: <T,>(value: T) => (h.debounceLagged !== undefined ? h.debounceLagged : value),
    useStUsdsData: () => ({ data: h.stUsdsData }),
    useStUsdsCapacityData: () => ({ data: { remainingCapacityBuffered: parseUnits('100000', 18) } }),
    useStUsdsWithdrawBalances: () => h.withdrawBalances,
    useStUsdsProviderSelection: () => ({
      selectedProvider: h.selectedProvider,
      selectionReason: 'native_default',
      selectedQuote: h.selectionQuote,
      nativeProvider: undefined,
      curveProvider: undefined,
      allProvidersBlocked: false,
      rateDifferencePercent: 0,
      isSelectionLoading: false,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })
  };
});

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    expertRiskDisclaimerShown: true,
    userConfig: {},
    updateUserConfig: vi.fn()
  })
}));

import { useStUsdsTransactionForm } from './useStUsdsTransactionForm';

const setState = ({
  nativeMax = NATIVE_MAX,
  curveMaxWithdraw,
  withdrawProvider = 'native',
  withdrawBalancesLoading = false
}: {
  nativeMax?: bigint;
  curveMaxWithdraw?: bigint;
  withdrawProvider?: 'native' | 'curve';
  withdrawBalancesLoading?: boolean;
} = {}) => {
  h.stUsdsData = {
    userUsdsBalance: parseUnits('2000', 18),
    userStUsdsBalance: parseUnits('950', 18),
    userSuppliedUsds: POSITION,
    userMaxWithdrawBuffered: nativeMax,
    moduleRate: 0n
  };
  h.withdrawBalances = {
    effectiveBalance: curveMaxWithdraw ?? POSITION,
    curveMaxWithdraw,
    nativeBalance: POSITION,
    userStUsdsBalance: parseUnits('950', 18),
    selectedProvider: withdrawProvider,
    isLoading: withdrawBalancesLoading,
    error: null
  };
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

const renderForm = (flow: 'supply' | 'withdraw' = 'withdraw') =>
  renderHook(() => useStUsdsTransactionForm({ flow }), { wrapper });

describe('useStUsdsTransactionForm flag-driven max withdraw (APP-507)', () => {
  beforeEach(() => {
    setState();
    h.selectedProvider = 'native';
    h.selectionQuote = undefined;
    h.debounceLagged = undefined;
  });
  afterEach(() => cleanup());

  it('Max derives the display from the current native max and follows it when it drifts', () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.value).toBe('600');
    expect(result.current.engineParams.max).toBe(true);

    setState({ nativeMax: parseUnits('650', 18) });
    rerender();
    expect(result.current.value).toBe('650');
    expect(result.current.amount).toBe(parseUnits('650', 18));
  });

  it('follows the Curve max when Curve backs the withdrawal', () => {
    setState({ curveMaxWithdraw: parseUnits('1005', 18), withdrawProvider: 'curve' });
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.value).toBe('1005');

    setState({ curveMaxWithdraw: parseUnits('1010', 18), withdrawProvider: 'curve' });
    rerender();
    expect(result.current.value).toBe('1010');
  });

  it('keeps following unconditionally — no freeze condition to strand after an error', () => {
    // The old resync froze on txStatus !== IDLE, which outlived a failed tx
    // (Back leaves ERROR standing) and reintroduced the drift. The derived
    // display has no guard to get stuck.
    const { result, rerender } = renderForm();
    act(() => result.current.setMaxAmount());

    setState({ nativeMax: parseUnits('650', 18) });
    rerender();
    setState({ nativeMax: parseUnits('700', 18) });
    rerender();
    expect(result.current.value).toBe('700');
  });

  it('typing clears Max and returns to the typed value', () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    act(() => result.current.onInput('250'));

    setState({ nativeMax: parseUnits('650', 18) });
    rerender();
    expect(result.current.value).toBe('250');
    expect(result.current.engineParams.max).toBe(false);
  });

  it('max is exempt from the insufficient/debounce gating (no confirm flicker on drift)', () => {
    const { result, rerender } = renderForm();
    act(() => result.current.setMaxAmount());

    // Simulate the debounce still settling on the pre-drift amount.
    setState({ nativeMax: parseUnits('650', 18) });
    h.debounceLagged = NATIVE_MAX;
    rerender();

    expect(result.current.debouncePending).toBe(true);
    expect(result.current.amountReady).toBe(true);

    // The same lag on a typed amount still gates confirm.
    h.debounceLagged = undefined;
    act(() => result.current.onInput('250'));
    h.debounceLagged = parseUnits('100', 18);
    rerender();
    expect(result.current.amountReady).toBe(false);
  });

  it('holds confirm after Max on a fresh form until the debounce settles off 0', () => {
    // The amount surfaces (review grid, toasts) read the debounced value, which
    // is still 0n right after Max is clicked on a fresh form — confirming in
    // that window would submit a full redemption labeled "0.00 USDS".
    const { result, rerender } = renderForm();

    h.debounceLagged = 0n;
    act(() => result.current.setMaxAmount());
    expect(result.current.amount).toBe(0n);
    expect(result.current.amountReady).toBe(false);

    h.debounceLagged = undefined;
    rerender();
    expect(result.current.amount).toBe(NATIVE_MAX);
    expect(result.current.amountReady).toBe(true);
  });

  it('holds confirm while the Curve max quote is loading instead of trusting the native fallback', () => {
    setState({ withdrawProvider: 'curve', curveMaxWithdraw: undefined, withdrawBalancesLoading: true });
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.amountReady).toBe(false);

    setState({ withdrawProvider: 'curve', curveMaxWithdraw: parseUnits('1005', 18) });
    rerender();
    expect(result.current.value).toBe('1005');
    expect(result.current.amountReady).toBe(true);
  });

  it('a drained max shows 0 and disables confirm', () => {
    const { result, rerender } = renderForm();
    act(() => result.current.setMaxAmount());

    setState({ nativeMax: 0n });
    rerender();
    expect(result.current.value).toBe('0');
    expect(result.current.amountReady).toBe(false);
  });

  it('price-impact acknowledgement holds while the max drifts at stable (or better) impact', () => {
    setState({ curveMaxWithdraw: parseUnits('1005', 18), withdrawProvider: 'curve' });
    h.selectedProvider = 'curve';
    h.selectionQuote = { rateInfo: { priceImpactBps: 350 }, outputAmount: 0n, inputAmount: 0n };
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.needsImpactAcknowledgement).toBe(true);
    act(() => result.current.setImpactAccepted(true));
    expect(result.current.impactAccepted).toBe(true);

    // Amount drift within the same impact floor — no re-check treadmill.
    setState({ curveMaxWithdraw: parseUnits('1010', 18), withdrawProvider: 'curve' });
    h.selectionQuote = { rateInfo: { priceImpactBps: 390 }, outputAmount: 0n, inputAmount: 0n };
    rerender();
    expect(result.current.impactAccepted).toBe(true);

    // Improving impact also holds — the user accepted worse.
    h.selectionQuote = { rateInfo: { priceImpactBps: 250 }, outputAmount: 0n, inputAmount: 0n };
    rerender();
    expect(result.current.impactAccepted).toBe(true);
  });

  it('price-impact acknowledgement lapses when the impact floors above the acknowledged percent', () => {
    setState({ curveMaxWithdraw: parseUnits('1005', 18), withdrawProvider: 'curve' });
    h.selectedProvider = 'curve';
    h.selectionQuote = { rateInfo: { priceImpactBps: 350 }, outputAmount: 0n, inputAmount: 0n };
    const { result, rerender } = renderForm();

    act(() => result.current.setMaxAmount());
    act(() => result.current.setImpactAccepted(true));
    expect(result.current.impactAccepted).toBe(true);

    // 3.5% → 4.2%: the checkbox would now read "exceeds 4%" — re-gate.
    h.selectionQuote = { rateInfo: { priceImpactBps: 420 }, outputAmount: 0n, inputAmount: 0n };
    rerender();
    expect(result.current.impactAccepted).toBe(false);
    expect(result.current.needsImpactAcknowledgement).toBe(true);
  });

  it('supply Max fills the wallet balance once and never follows (max is withdraw-only)', () => {
    const { result, rerender } = renderForm('supply');

    act(() => result.current.setMaxAmount());
    expect(result.current.value).toBe('2000');
    expect(result.current.engineParams.max).toBe(false);

    setState();
    h.stUsdsData = { ...h.stUsdsData!, userUsdsBalance: parseUnits('2500', 18) };
    rerender();
    expect(result.current.value).toBe('2000');
  });

  it('the 100% chip behaves like Max', () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setPercentAmount(100));
    expect(result.current.value).toBe('600');
    expect(result.current.engineParams.max).toBe(true);

    setState({ nativeMax: parseUnits('700', 18) });
    rerender();
    expect(result.current.value).toBe('700');
  });
});
