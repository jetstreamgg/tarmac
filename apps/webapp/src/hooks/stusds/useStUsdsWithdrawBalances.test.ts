/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStUsdsWithdrawBalances } from './useStUsdsWithdrawBalances';
import { StUsdsDirection, StUsdsProviderType } from './providers/types';

const WAD = 10n ** 18n;
// 100 shares worth 110 USDS.
const SHARES = 100n * WAD;
const ASSETS = 110n * WAD;

const h = vi.hoisted(() => ({
  selection: vi.fn(),
  selectedProvider: 'native'
}));

vi.mock('./useStUsdsData', () => ({
  useStUsdsData: () => ({
    data: { userStUsdsBalance: SHARES, userSuppliedUsds: ASSETS },
    isLoading: false,
    error: null
  })
}));

vi.mock('./providers/useStUsdsProviderSelection', () => ({
  useStUsdsProviderSelection: (params: unknown) => {
    h.selection(params);
    return { selectedProvider: h.selectedProvider, isLoading: false };
  }
}));

vi.mock('./providers/useCurveQuote', () => ({
  useCurveQuote: () => ({ data: { usdsAmount: 108n * WAD }, isLoading: false })
}));

describe('useStUsdsWithdrawBalances', () => {
  it("selects the route on the position's USDS value, not its share balance", () => {
    renderHook(() => useStUsdsWithdrawBalances());

    expect(h.selection).toHaveBeenLastCalledWith({
      direction: StUsdsDirection.WITHDRAW,
      amount: ASSETS,
      userStUsdsBalance: SHARES
    });
  });

  it('reports the native balance on the native route and the Curve max on the Curve route', () => {
    h.selectedProvider = StUsdsProviderType.NATIVE;
    expect(renderHook(() => useStUsdsWithdrawBalances()).result.current.effectiveBalance).toBe(ASSETS);

    h.selectedProvider = StUsdsProviderType.CURVE;
    expect(renderHook(() => useStUsdsWithdrawBalances()).result.current.effectiveBalance).toBe(108n * WAD);
  });
});
