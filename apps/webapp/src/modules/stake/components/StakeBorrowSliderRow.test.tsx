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
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    const root = screen.getByTestId('row');
    // Dust axis 30k → 100k: 30k debt sits on the left end (no interior tick),
    // 20k staged → thumb 2/7 (285); no dots on borrow.
    expect(slider.markers).toEqual([]);
    expect(slider.value).toBe(285);
    expect(root.querySelector('[data-slot="slider-marker"]')).toBeNull();
    expect(root.querySelector('[data-slot="slider-dots"]')).toBeNull();
    expect(root.querySelector('[data-slot="slider-end-dot"]')).toBeNull();
    const fill = root.querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.left).toBe('0%');
    expect(fill.className).toContain('from-slider-yellow-start');
    expect(fill.querySelector('[data-slot="slider-fill-marker"]')?.className).toContain('bg-black');
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
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    expect(slider.value).toBe(1000);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onAmountChange).toHaveBeenCalledWith(usds(11_666));
  });

  it('borrow-more: tick and shade at the current debt when it clears the dust floor', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(60_000),
      dust: usds(30_000),
      headroom: usds(40_000),
      amount: usds(20_000),
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    const root = screen.getByTestId('row');
    // Axis 30k → 100k: tick 3/7 (428), thumb 5/7 (714).
    expect(slider.markers).toEqual([428]);
    expect((root.querySelector('[data-slot="slider-borrowed"]') as HTMLElement).style.width).toBe('42.8%');
    expect((root.querySelector('[data-slot="slider-marker"]') as HTMLElement).style.left).toBe('42.8%');
    expect((root.querySelector('[data-slot="slider-fill"]') as HTMLElement).style.left).toBe('42.8%');
    expect(screen.getByTestId('row-marker-label').textContent).toBe('Borrowed:60,000');
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
    renderRow(<StakeBorrowSliderRow slider={slider} mode="repay" tone="green" dataTestId="row" />);
    const root = screen.getByTestId('row');
    expect(root.querySelector('[data-slot="slider-borrowed"]')).toBeNull();
    expect(root.querySelector('[data-slot="slider-marker"]')).toBeNull();
    const fill = root.querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.left).toBe('0%');
    expect(fill.className).toContain('from-slider-green-start');
    expect(screen.getByTestId('row-marker-label').textContent).toBe('Repay:26,000');
    // Dots only over the partial-repay zone (0 → 26k = 46.4%) plus the end dot.
    expect((root.querySelector('[data-slot="slider-dots"]') as HTMLElement).style.width).toBe('46.4%');
    expect(root.querySelector('[data-slot="slider-end-dot"]')).not.toBeNull();
  });

  it('colours the fill by the resulting risk, not by the axis', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: 0n,
      dust: usds(30_000),
      headroom: usds(70_000),
      amount: usds(30_000),
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="green" dataTestId="row" />);
    const fill = screen.getByTestId('row').querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.className).toContain('from-slider-green-start');
    expect(fill.className).not.toContain('from-slider-yellow-start');
  });

  it('borrow: a debt on the dust floor is carried by the min label', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000),
      dust: usds(30_000),
      headroom: usds(11_666),
      amount: 0n,
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    expect(slider.atFloor).toBe(true);
    expect(screen.getByTestId('row-min-label').textContent).toBe('Borrowed:30,000 (Min.)');
    expect(screen.queryByTestId('row-marker-label')).toBeNull();
  });

  it('borrow: a debt a few wei over the floor (accrued fee) still reads as the floor', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000) + 12_345n,
      dust: usds(30_000),
      headroom: usds(1_250),
      amount: 0n,
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    expect(slider.atFloor).toBe(true);
    expect(slider.markers).toEqual([]);
    expect(screen.getByTestId('row-min-label').textContent).toBe('Borrowed:30,000 (Min.)');
  });

  it('borrow-more: hides the tick label when it would print over an end label', () => {
    const rects: Record<string, Partial<DOMRect>> = {
      'row-min-label': { left: 0, right: 60 },
      'row-max-label': { left: 480, right: 546 },
      'row-marker-label': { left: 430, right: 530 }
    };
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return { left: 0, right: 0, ...rects[this.dataset.testid ?? ''] } as DOMRect;
    });
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(56_201),
      dust: usds(30_000),
      headroom: usds(6_299),
      amount: 0n,
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    expect(screen.getByTestId('row-marker-label').className).toContain('invisible');
    // The tick line itself stays.
    expect(screen.getByTestId('row').querySelector('[data-slot="slider-marker"]')).not.toBeNull();
    spy.mockRestore();
  });

  it('disabled: a flat full-width bar keeping its inverse marker', () => {
    const slider = useStakeAmountSlider({
      mode: 'borrow',
      existingDebt: usds(30_000),
      dust: usds(30_000),
      headroom: 0n,
      amount: 0n,
      onAmountChange: vi.fn()
    });
    renderRow(<StakeBorrowSliderRow slider={slider} mode="borrow" tone="yellow" dataTestId="row" />);
    const fill = screen.getByTestId('row').querySelector('[data-slot="slider-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.className).toContain('bg-fgQuaternary');
    expect(fill.querySelector('[data-slot="slider-fill-marker"]')?.className).toContain('bg-[#090420]');
  });
});
