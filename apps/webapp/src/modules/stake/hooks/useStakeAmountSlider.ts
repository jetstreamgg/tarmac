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
  /** Borrow only: the debt sits on the dust floor, so the tick would be the left end. */
  atFloor: boolean;
  /** Amounts behind the end labels and the interior tick. */
  axis: { min: bigint; max: bigint; marker: bigint | undefined };
};

/**
 * Amount-linear slider (Figma "Charts / Progress Steps"). The thumb is a pure
 * projection of the staged amount, so typing, chips and dragging can never
 * disagree; over-typed amounts pin at 100%.
 *
 * Borrow axis: total debt, dust → existingDebt + headroom. Left of the current
 * debt stages 0; on a debt-free position the left end is the dust floor; the
 * right end stages the exact headroom (debt-ceiling aware).
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
      atFloor: false,
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

  // Figma axis runs from the dust floor ("Min.") to the ceiling, so an amount at
  // the floor sits on the empty stub (3015:59627) and the whole bar is live.
  const max = existingDebt + headroom;
  const noHeadroom = headroom <= 0n;
  const disabled = forcedDisabled || noHeadroom;
  const span = max - minBorrow;
  // min == max (3015:59201): a full bar with the amount at the floor.
  const value =
    disabled || span <= 0n ? STAKE_SLIDER_MAX : toPosition(existingDebt + amount - minBorrow, span);
  const marker = disabled ? undefined : interiorMarker(existingDebt - minBorrow, span);
  // Accrued fees lift a dust-floor debt a few wei above the floor; treat a
  // tick that rounds onto the left end as the floor.
  const onFloor = existingDebt > 0n && toPosition(existingDebt - minBorrow, span) === 0;
  return {
    value,
    markers: marker ? [marker.position] : [],
    progress: disabled ? 0 : value / (STAKE_SLIDER_MAX / 100),
    disabled,
    hidden: false,
    atFloor: !disabled && onFloor,
    // Nothing borrowable: the ceiling is the current debt (3015:62542).
    axis: { min: minBorrow, max: noHeadroom ? existingDebt : max, marker: marker && existingDebt },
    onValueChange: position => {
      if (disabled || max <= 0n) return;
      if (position >= STAKE_SLIDER_MAX || span <= 0n) {
        onAmountChange(headroom);
        return;
      }
      const total = minBorrow + (span * BigInt(position)) / STEPS;
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
