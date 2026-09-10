import { describe, expect, it, vi } from 'vitest';
import { STAKE_SLIDER_MAX, useStakeAmountSlider } from './useStakeAmountSlider';

const WAD = 10n ** 18n;
const usds = (n: number) => BigInt(n) * WAD;

describe('useStakeAmountSlider — borrow axis', () => {
  const base = { mode: 'borrow' as const, dust: usds(30_000), headroom: usds(40_000) };

  it('projects the staged amount onto the total-debt axis with a tick at the current debt', () => {
    const slider = useStakeAmountSlider({
      ...base,
      existingDebt: usds(60_000),
      amount: usds(20_000),
      onAmountChange: vi.fn()
    });
    // 80,000 of 100,000
    expect(slider.value).toBe(800);
    expect(slider.markers).toEqual([600]);
    expect(slider.axis).toEqual({ min: usds(30_000), max: usds(100_000), marker: usds(60_000) });
    expect(slider.disabled).toBe(false);
  });

  it('pins an over-typed amount at the right end instead of overflowing', () => {
    const slider = useStakeAmountSlider({
      ...base,
      existingDebt: usds(60_000),
      amount: usds(999_999),
      onAmountChange: vi.fn()
    });
    expect(slider.value).toBe(STAKE_SLIDER_MAX);
    expect(slider.progress).toBe(100);
  });

  it('stages 0 left of the current debt and the exact headroom at the right end', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({
      ...base,
      headroom: usds(40_000) + 123n,
      existingDebt: usds(60_000),
      amount: 0n,
      onAmountChange
    });
    slider.onValueChange(300);
    expect(onAmountChange).toHaveBeenLastCalledWith(0n);
    slider.onValueChange(STAKE_SLIDER_MAX);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(40_000) + 123n);
    slider.onValueChange(800);
    // 80,000 total − 60,000 debt, whole USDS
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(20_000));
  });

  it('snaps the (0, dust) gap up to dust on a debt-free position', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({ ...base, existingDebt: 0n, amount: 0n, onAmountChange });
    slider.onValueChange(100); // 4,000 of 40,000
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(30_000));
    slider.onValueChange(900);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(36_000));
    expect(slider.markers).toEqual([]);
  });

  it('disables the axis when nothing is borrowable and collapses the labels onto the debt', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({
      ...base,
      headroom: 0n,
      existingDebt: usds(60_000),
      amount: 0n,
      onAmountChange
    });
    expect(slider.disabled).toBe(true);
    expect(slider.value).toBe(STAKE_SLIDER_MAX);
    expect(slider.progress).toBe(0);
    expect(slider.axis.min).toBe(usds(60_000));
    expect(slider.axis.max).toBe(usds(60_000));
    slider.onValueChange(500);
    expect(onAmountChange).not.toHaveBeenCalled();
  });

  it('survives min == max (dust equals the headroom) without a 0/0', () => {
    const slider = useStakeAmountSlider({
      ...base,
      headroom: usds(30_000),
      existingDebt: 0n,
      amount: usds(30_000),
      onAmountChange: vi.fn()
    });
    expect(slider.value).toBe(STAKE_SLIDER_MAX);
    expect(Number.isFinite(slider.progress)).toBe(true);
  });
});

describe('useStakeAmountSlider — repay axis', () => {
  const base = { mode: 'repay' as const, dust: usds(30_000), headroom: 0n, existingDebt: usds(56_000) };

  it('runs 0 → debt with a tick at debt − dust', () => {
    const slider = useStakeAmountSlider({ ...base, amount: usds(13_000), onAmountChange: vi.fn() });
    expect(slider.value).toBe(232);
    expect(slider.markers).toEqual([464]);
    expect(slider.axis).toEqual({ min: 0n, max: usds(56_000), marker: usds(26_000) });
    expect(slider.hidden).toBe(false);
  });

  it('stages the full debt with wipeAll at the right end', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({ ...base, amount: 0n, onAmountChange });
    slider.onValueChange(STAKE_SLIDER_MAX);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(56_000), true);
  });

  it('snaps the dust gap to the nearer end', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({ ...base, amount: 0n, onAmountChange });
    slider.onValueChange(500); // 28,000: 2,000 past the gap start, 28,000 short of full
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(26_000));
    slider.onValueChange(950); // 53,200: nearer the full repay
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(56_000), true);
  });

  it('pins an over-typed repay at 100% and hides the axis on a debt-free position', () => {
    const over = useStakeAmountSlider({ ...base, amount: usds(70_000), onAmountChange: vi.fn() });
    expect(over.value).toBe(STAKE_SLIDER_MAX);
    const none = useStakeAmountSlider({ ...base, existingDebt: 0n, amount: 0n, onAmountChange: vi.fn() });
    expect(none.hidden).toBe(true);
  });

  it('treats any positive drag as a full repay when the debt sits at or below dust', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({
      ...base,
      existingDebt: usds(30_000),
      amount: 0n,
      onAmountChange
    });
    expect(slider.markers).toEqual([]);
    slider.onValueChange(200);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(30_000), true);
  });
});
