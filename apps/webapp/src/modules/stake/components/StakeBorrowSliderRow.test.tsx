import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StakeBorrowSliderRow } from './StakeBorrowSliderRow';
import { useStakeAmountSlider } from '../hooks/useStakeAmountSlider';

const WAD = 10n ** 18n;
const usds = (n: number) => BigInt(n) * WAD;
i18n.load('en', {});
i18n.activate('en');
const renderRow = (ui: React.ReactElement) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);

describe('StakeBorrowSliderRow', () => {
  it('borrow: colours only the delta from the current-debt tick to the thumb', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000),
      dust: usds(30_000),
      headroom: usds(70_000),
      amount: usds(20_000),
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" dataTestId="row" />);
    const root = screen.getByTestId('row');
    const delta = root.querySelector('[data-slot="slider-delta-range"]') as HTMLElement;
    // jsdom drops the nested calc() geometry; the delta fill replacing the
    // Radix range is the contract (fractions come from the hook: tick 300, thumb 500).
    expect(delta).toBeTruthy();
    expect(slider.markers).toEqual([300]);
    expect(slider.value).toBe(500);
    expect(root.querySelector('[data-slot="slider-range"]')?.className).toContain('hidden');
  });

  it('borrow: End on an over-typed, pinned thumb still snaps to the headroom', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000),
      dust: usds(30_000),
      headroom: usds(11_666),
      amount: usds(99_999),
      onAmountChange
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" dataTestId="row" />);
    expect(slider.value).toBe(1000);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onAmountChange).toHaveBeenCalledWith(usds(11_666));
  });

  it('repay: keeps the fill from the left end', () => {
    const slider = useStakeAmountSlider({
      mode: 'repay',
      existingDebt: usds(56_000),
      dust: usds(30_000),
      headroom: 0n,
      amount: usds(13_000),
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="repay" dataTestId="row" />);
    expect(screen.getByTestId('row').querySelector('[data-slot="slider-delta-range"]')).toBeNull();
  });
});
