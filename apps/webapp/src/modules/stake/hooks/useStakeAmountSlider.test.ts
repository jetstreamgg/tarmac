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
    // Axis 30k → 100k: tick 3/7, thumb 5/7.
    expect(slider.value).toBe(714);
    expect(slider.markers).toEqual([428]);
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
    // 30,000 + 0.8 × 70,000 = 86,000 total − 60,000 debt, whole USDS
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(26_000));
  });

  it('starts a debt-free position at the dust floor (3015:59627)', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({ ...base, existingDebt: 0n, amount: usds(30_000), onAmountChange });
    expect(slider.value).toBe(0);
    slider.onValueChange(0);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(30_000));
    slider.onValueChange(100); // 30,000 + 1,000
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(31_000));
    slider.onValueChange(900);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(39_000));
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
    // 3015:62542: Min. dust / Max. current debt.
    expect(slider.axis.min).toBe(usds(30_000));
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

  it('forgives a short overshoot past the dotted zone, then snaps to the full repay', () => {
    const onAmountChange = vi.fn();
    const slider = useStakeAmountSlider({ ...base, amount: 0n, onAmountChange });
    slider.onValueChange(500); // 28,000: 2,000 into the gap, within the 4% buffer (2,240)
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(26_000));
    slider.onValueChange(510); // 28,560: past the buffer
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(56_000), true);
    // A gap narrower than twice the buffer caps it at half the gap.
    const narrow = useStakeAmountSlider({ ...base, dust: usds(2_000), amount: 0n, onAmountChange });
    narrow.onValueChange(985); // 55,160: 1,160 into a 2,000 gap, past its half
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

describe('useStakeAmountSlider — stretched zones', () => {
  const useRepay = (existingDebt: bigint, amount = 0n, onAmountChange = vi.fn()) => ({
    slider: useStakeAmountSlider({
      mode: 'repay',
      dust: usds(30_000),
      headroom: 0n,
      existingDebt,
      amount,
      onAmountChange
    }),
    onAmountChange
  });

  it('repay: a thin partial zone stretches to 30% of the track and rounds to a unit that gives it stops', () => {
    const { slider, onAmountChange } = useRepay(usds(30_020));
    expect(slider.markers).toEqual([300]);
    expect(slider.axis.marker).toBe(usds(20));
    slider.onValueChange(150);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(10));
    slider.onValueChange(3);
    expect(onAmountChange).toHaveBeenLastCalledWith(WAD / 5n);
    expect(useRepay(usds(30_020), usds(10)).slider.value).toBe(150);
  });

  it('repay: a debt within 1 USDS of dust has no partial zone', () => {
    expect(useRepay(usds(30_000) + 5n).slider.markers).toEqual([]);
  });

  it('repay: a thin dust gap keeps 10% of the track', () => {
    const { slider } = useRepay(usds(400_000));
    expect(slider.markers).toEqual([900]);
    expect(useRepay(usds(400_000), usds(385_000)).slider.value).toBe(950);
  });

  it('repay: the gap latches on threshold crossings, not on heading', () => {
    const { slider, onAmountChange } = useRepay(usds(30_020));
    slider.onValueChange(341, 340);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(30_020), true);
    // Staged full: jitter mid-gap holds, leaving needs to cross 40 short of the end.
    const full = useRepay(usds(30_020), usds(30_020));
    full.slider.onValueChange(340, 342);
    expect(full.onAmountChange).toHaveBeenLastCalledWith(usds(30_020), true);
    full.slider.onValueChange(959, 960);
    expect(full.onAmountChange).toHaveBeenLastCalledWith(usds(20));
    // Staged at the tick: heading right mid-gap holds until the right end.
    const partial = useRepay(usds(30_020), usds(20));
    partial.slider.onValueChange(999, 900);
    expect(partial.onAmountChange).toHaveBeenLastCalledWith(usds(20));
  });

  it('borrow: a thin live zone stretches to 30% of the track', () => {
    const onAmountChange = vi.fn();
    const args = {
      mode: 'borrow' as const,
      dust: usds(30_000),
      existingDebt: usds(56_268),
      headroom: usds(607)
    };
    const slider = useStakeAmountSlider({ ...args, amount: 0n, onAmountChange });
    expect(slider.markers).toEqual([700]);
    slider.onValueChange(500);
    expect(onAmountChange).toHaveBeenLastCalledWith(0n);
    slider.onValueChange(850);
    expect(onAmountChange).toHaveBeenLastCalledWith(usds(303));
    expect(useStakeAmountSlider({ ...args, amount: usds(303), onAmountChange }).value).toBe(849);
  });
});
