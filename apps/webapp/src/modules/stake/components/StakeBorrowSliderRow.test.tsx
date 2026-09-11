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
  it('borrow: shades the borrowed share, ticks the current debt and colours only the delta', () => {
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
    // Hook: tick 300, thumb 500 → borrowed shade 30%, fill from 30% to 50%.
    expect(slider.markers).toEqual([300]);
    expect(slider.value).toBe(500);
    expect((root.querySelector('[data-slot="slider-borrowed"]') as HTMLElement).style.width).toBe('30%');
    expect((root.querySelector('[data-slot="slider-marker"]') as HTMLElement).style.left).toBe('30%');
    const fill = root.querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.left).toBe('30%');
    expect(fill.className).toContain('from-slider-yellow-start');
    expect(screen.getByTestId('row-marker-label').textContent).toBe('Borrowed:30,000');
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

  it('repay: green fill from the left end, dust-gap tick label, no borrowed shade', () => {
    const slider = useStakeAmountSlider({
      mode: 'repay',
      existingDebt: usds(56_000),
      dust: usds(30_000),
      headroom: 0n,
      amount: usds(13_000),
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="repay" dataTestId="row" />);
    const root = screen.getByTestId('row');
    expect(root.querySelector('[data-slot="slider-borrowed"]')).toBeNull();
    expect(root.querySelector('[data-slot="slider-marker"]')).toBeNull();
    const fill = root.querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.left).toBe('0%');
    expect(fill.className).toContain('from-slider-green-start');
    expect(screen.getByTestId('row-marker-label').textContent).toBe('Repay:26,000');
  });

  it('disabled: a flat full-width bar without marker', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000),
      dust: usds(30_000),
      headroom: 0n,
      amount: 0n,
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" dataTestId="row" />);
    const fill = screen.getByTestId('row').querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.className).toContain('bg-fgQuaternary');
    expect(fill.querySelector('[data-slot="slider-fill-marker"]')).toBeNull();
  });
});
