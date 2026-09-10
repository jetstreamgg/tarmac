/** Slider resolution: 1000 stops keeps a drag smooth on a 600px track. */
export const STAKE_SLIDER_MAX = 1000;
const STEPS = BigInt(STAKE_SLIDER_MAX);
const WAD = 10n ** 18n;

const roundToWholeUsds = (amount: bigint): bigint => (amount / WAD) * WAD;

const toPosition = (value: bigint, max: bigint): number => {
  if (max <= 0n) return 0;
  if (value <= 0n) return 0;
  if (value >= max) return STAKE_SLIDER_MAX;
  return Number((value * STEPS) / max);
};

// An interior tick only; one that rounds onto an end would overlap the end label.
const interiorMarker = (value: bigint | undefined, max: bigint) => {
  if (value === undefined) return undefined;
  const position = toPosition(value, max);
  return position > 0 && position < STAKE_SLIDER_MAX ? { value, position } : undefined;
};

export type StakeAmountSlider = {
  /** Thumb position in [0, STAKE_SLIDER_MAX], derived from `amount`. */
  value: number;
  onValueChange: (position: number) => void;
  /** Interior tick positions (same domain as `value`). */
  markers: number[];
  /** Coloured share of the tick row, 0–100. */
  progress: number;
  /** Nothing to stage on this axis: flat grey track, input and chips off. */
  disabled: boolean;
  /** No axis at all (repay on a debt-free position). */
  hidden: boolean;
  /** Amounts behind the end labels and the interior tick. */
  axis: { min: bigint; max: bigint; marker: bigint | undefined };
};

/**
 * Amount-linear slider (Figma "Charts / Progress Steps"). The thumb is a pure
 * projection of the staged amount, so typing, chips and dragging can never
 * disagree; over-typed amounts pin at 100%.
 *
 * Borrow axis: total debt, 0 → existingDebt + headroom. Left of the current
 * debt stages 0; on a debt-free position the (0, dust) gap snaps up to dust;
 * the right end stages the exact headroom (debt-ceiling aware).
 *
 * Repay axis: repaid amount, 0 → debt. The (debt − dust, debt) gap snaps to
 * the nearer end; the right end stages the full debt with wipeAll.
 */
export function useStakeAmountSlider({
  mode,
  existingDebt,
  dust,
  headroom,
  amount,
  onAmountChange,
  disabled: forcedDisabled = false
}: {
  mode: 'borrow' | 'repay';
  existingDebt: bigint;
  dust: bigint | undefined;
  /** Borrow only: min(debt-ceiling headroom, collateral-safe max). */
  headroom: bigint;
  amount: bigint;
  onAmountChange: (amount: bigint, wipeAll?: boolean) => void;
  disabled?: boolean;
}): StakeAmountSlider {
  const minBorrow = dust ?? 0n;

  if (mode === 'repay') {
    const max = existingDebt;
    const gapStart = max - minBorrow;
    const marker = interiorMarker(gapStart, max);
    const value = toPosition(amount, max);
    return {
      value,
      markers: marker ? [marker.position] : [],
      progress: value / (STAKE_SLIDER_MAX / 100),
      disabled: forcedDisabled,
      hidden: max <= 0n,
      axis: { min: 0n, max, marker: marker?.value },
      onValueChange: position => {
        if (max <= 0n) return;
        if (position >= STAKE_SLIDER_MAX) {
          onAmountChange(max, true);
          return;
        }
        const raw = (max * BigInt(position)) / STEPS;
        if (raw <= 0n) {
          onAmountChange(0n);
          return;
        }
        if (raw > gapStart) {
          // Dust gap: nearer end wins; an unreachable partial max means full repay.
          const nearerFull = gapStart <= 0n || raw - gapStart > max - raw;
          if (nearerFull) onAmountChange(max, true);
          else onAmountChange(gapStart);
          return;
        }
        onAmountChange(roundToWholeUsds(raw));
      }
    };
  }

  const max = existingDebt + headroom;
  const noHeadroom = headroom <= 0n;
  const disabled = forcedDisabled || noHeadroom;
  const value = toPosition(existingDebt + amount, max);
  const marker = interiorMarker(existingDebt, max);
  return {
    value,
    markers: marker ? [marker.position] : [],
    progress: disabled ? 0 : value / (STAKE_SLIDER_MAX / 100),
    disabled,
    hidden: false,
    axis: {
      // With nothing borrowable the ends collapse onto the current debt.
      min: noHeadroom ? existingDebt : minBorrow,
      max,
      marker: marker?.value
    },
    onValueChange: position => {
      if (disabled || max <= 0n) return;
      if (position >= STAKE_SLIDER_MAX) {
        onAmountChange(headroom);
        return;
      }
      const total = (max * BigInt(position)) / STEPS;
      let next = total - existingDebt;
      if (next <= 0n) {
        onAmountChange(0n);
        return;
      }
      next = roundToWholeUsds(next);
      if (existingDebt === 0n && next < minBorrow) next = minBorrow;
      onAmountChange(next > headroom ? headroom : next);
    }
  };
}
