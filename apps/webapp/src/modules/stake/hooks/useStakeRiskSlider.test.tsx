import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Vault } from '@/hooks';
import { useStakeRiskSlider } from './useStakeRiskSlider';

const WAD = 10n ** 18n;

// Minimal vault shape for the new-position (no existing debt) path.
const vaultWith = (overrides: Partial<Vault>): Vault =>
  ({
    liquidationProximityPercentage: 0,
    maxSafeBorrowableIntAmount: 0n,
    maxSafeBorrowableIntAmountNoCap: 0n,
    debtValue: 0n,
    collateralAmount: 0n,
    ...overrides
  }) as Vault;

describe('useStakeRiskSlider (open flow — no existing debt)', () => {
  it('maps a slider percentage to a whole-USDS borrow amount against the uncapped max', () => {
    const setUsdsToBorrow = vi.fn();
    const vault = vaultWith({
      maxSafeBorrowableIntAmountNoCap: 65500n * WAD + 123n, // non-round max
      maxSafeBorrowableIntAmount: 65500n * WAD + 123n,
      debtValue: 42n * WAD,
      collateralAmount: 100000n * WAD
    });

    const { result } = renderHook(() =>
      useStakeRiskSlider({
        vault,
        usdsToBorrow: 0n,
        setUsdsToBorrow,
        usdsToWipe: 0n,
        setUsdsToWipe: vi.fn()
      })
    );

    act(() => result.current.handleSliderChange(50));
    // 50% of max, rounded down to whole USDS — legacy roundToWholeUsds.
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(((65500n * WAD + 123n) / 2n / WAD) * WAD);

    act(() => result.current.handleSliderChange(100));
    // 100% = the exact (unrounded) max.
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(65500n * WAD + 123n);

    act(() => result.current.handleSliderChange(0));
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(0n);
  });

  it('never stages beyond the OSM-capped max when the market-price max is higher', () => {
    const setUsdsToBorrow = vi.fn();
    const vault = vaultWith({
      // Diverged prices: market-based (uncapped) max far above the capped one.
      maxSafeBorrowableIntAmountNoCap: 65500n * WAD,
      maxSafeBorrowableIntAmount: 40000n * WAD,
      debtValue: 42n * WAD,
      collateralAmount: 100000n * WAD
    });

    const { result } = renderHook(() =>
      useStakeRiskSlider({
        vault,
        usdsToBorrow: 0n,
        setUsdsToBorrow,
        usdsToWipe: 0n,
        setUsdsToWipe: vi.fn()
      })
    );

    act(() => result.current.handleSliderChange(100));
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(40000n * WAD);

    act(() => result.current.handleSliderChange(80));
    // 80% of the uncapped max (52,400) still clamps to the capped amount.
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(40000n * WAD);

    act(() => result.current.handleSliderChange(30));
    // Below the cap the ordinary whole-USDS mapping applies.
    expect(setUsdsToBorrow).toHaveBeenLastCalledWith(((65500n * WAD * 30n) / 100n / WAD) * WAD);
  });

  it('ignores drags when nothing is borrowable', () => {
    const setUsdsToBorrow = vi.fn();
    const { result } = renderHook(() =>
      useStakeRiskSlider({
        vault: vaultWith({}),
        usdsToBorrow: 0n,
        setUsdsToBorrow,
        usdsToWipe: 0n,
        setUsdsToWipe: vi.fn()
      })
    );

    act(() => result.current.handleSliderChange(50));
    expect(setUsdsToBorrow).not.toHaveBeenCalled();
  });

  it('shows the slider only when the simulated vault has both debt and collateral', () => {
    const common = {
      usdsToBorrow: 0n,
      setUsdsToBorrow: vi.fn(),
      usdsToWipe: 0n,
      setUsdsToWipe: vi.fn()
    };
    const { result: withDebt } = renderHook(() =>
      useStakeRiskSlider({
        vault: vaultWith({ debtValue: WAD, collateralAmount: WAD, maxSafeBorrowableIntAmountNoCap: WAD }),
        ...common
      })
    );
    const { result: noDebt } = renderHook(() =>
      useStakeRiskSlider({
        vault: vaultWith({ collateralAmount: WAD }),
        ...common
      })
    );

    expect(withDebt.current.shouldShowSlider).toBe(true);
    expect(noDebt.current.shouldShowSlider).toBe(false);
  });

  it('tracks the simulated risk percentage as the slider position', () => {
    const { result } = renderHook(() =>
      useStakeRiskSlider({
        vault: vaultWith({
          liquidationProximityPercentage: 36,
          maxSafeBorrowableIntAmountNoCap: WAD,
          maxSafeBorrowableIntAmount: WAD,
          debtValue: WAD,
          collateralAmount: WAD
        }),
        usdsToBorrow: 0n,
        setUsdsToBorrow: vi.fn(),
        usdsToWipe: 0n,
        setUsdsToWipe: vi.fn()
      })
    );

    expect(result.current.sliderValue).toEqual([36]);
  });
});
