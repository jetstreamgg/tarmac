/** Slider resolution: 1000 stops keeps a drag smooth on a 600px track. */
export const STAKE_SLIDER_MAX = 1000;
const STEPS = BigInt(STAKE_SLIDER_MAX);
/** Overshoot past the dotted repay zone forgiven before snapping to the full repay. */
const SNAP_BUFFER_STEPS = 40n;
/** Repay: the partial zone never shrinks below this share of the track. */
const MIN_PARTIAL_STEPS = 300;
/** Repay: the dust-gap snap zone never shrinks below this share of the track either. */
const MIN_SNAP_STEPS = 100;
/** Borrow: the live zone right of the debt tick never shrinks below this share of the track. */
const MIN_LIVE_STEPS = 300;
/** Repay: a stretched partial zone stages at least this many distinct amounts. */
const MIN_ZONE_STOPS = 100n;
const WAD = 10n ** 18n;

/**
 * Rounding unit for a zone of `span` USDS: whole USDS when that gives at least
 * MIN_ZONE_STOPS stops, otherwise a decimal (down to cents) that does.
 */
const zoneUnit = (span: bigint): bigint => {
  let unit = WAD;
  while (unit > WAD / 100n && span / unit < MIN_ZONE_STOPS) unit /= 10n;
  return unit;
};

const toPosition = (value: bigint, max: bigint): number => {
  if (max <= 0n) return 0;
  if (value <= 0n) return 0;
  if (value >= max) return STAKE_SLIDER_MAX;
  return Number((value * STEPS) / max);
};

export type StakeAmountSlider = {
  /** Thumb position in [0, STAKE_SLIDER_MAX], derived from `amount`. */
  value: number;
  /** `previous`: where the pointer last was (the thumb when it was released); the repay gap snaps on crossings. */
  onValueChange: (position: number, previous?: number) => void;
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
 * Repay axis: repaid amount, 0 → debt. The dust gap (debt − dust, debt) snaps
 * to the full repay once the thumb is a short buffer past the dotted zone (4%
 * of the track, capped at half the gap): far enough to forgive an overshoot,
 * near enough that the jump reads at once. The right end stages the full debt
 * with wipeAll.
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
    // The partial-repay zone keeps at least MIN_PARTIAL_STEPS of the track when
    // there is at least 1 USDS to stage in it, and the dust gap keeps at least
    // MIN_SNAP_STEPS when there is one; the natural share applies in between.
    const naturalEnd = toPosition(gapStart, max);
    const partialEnd =
      gapStart >= WAD && naturalEnd < MIN_PARTIAL_STEPS && naturalEnd < STAKE_SLIDER_MAX
        ? MIN_PARTIAL_STEPS
        : minBorrow > 0n && naturalEnd > STAKE_SLIDER_MAX - MIN_SNAP_STEPS && naturalEnd < STAKE_SLIDER_MAX
          ? STAKE_SLIDER_MAX - MIN_SNAP_STEPS
          : naturalEnd;
    const snapSpan = STAKE_SLIDER_MAX - partialEnd;
    const toRepayPosition = (value: bigint): number => {
      if (max <= 0n || value <= 0n) return 0;
      if (value >= max) return STAKE_SLIDER_MAX;
      if (value <= gapStart) return Number((value * BigInt(partialEnd)) / gapStart);
      return partialEnd + Number(((value - gapStart) * BigInt(snapSpan)) / (max - gapStart));
    };
    const marker =
      partialEnd > 0 && partialEnd < STAKE_SLIDER_MAX ? { value: gapStart, position: partialEnd } : undefined;
    const value = toRepayPosition(amount);
    return {
      value,
      markers: marker ? [marker.position] : [],
      progress: value / (STAKE_SLIDER_MAX / 100),
      disabled: forcedDisabled,
      hidden: max <= 0n,
      atFloor: false,
      axis: { min: 0n, max, marker: marker?.value },
      onValueChange: (position, previous = value) => {
        if (max <= 0n) return;
        if (position >= STAKE_SLIDER_MAX) {
          onAmountChange(max, true);
          return;
        }
        if (position > partialEnd) {
          // Hysteresis: the full repay is entered by crossing a buffer past the
          // dots from the partial side and left by crossing a buffer short of the
          // right end from the end side. In between, the gap holds whatever is
          // staged, so pointer jitter mid-gap never flips it.
          const buffer = Math.min(Number(SNAP_BUFFER_STEPS), Math.floor(snapSpan / 2));
          const enterAt = partialEnd + buffer;
          const leaveAt = STAKE_SLIDER_MAX - buffer;
          const isFull = amount >= max;
          const full = isFull
            ? !(previous >= leaveAt && position < leaveAt)
            : previous <= enterAt && position > enterAt;
          if (full) onAmountChange(max, true);
          else onAmountChange(gapStart);
          return;
        }
        const raw = partialEnd > 0 ? (gapStart * BigInt(position)) / BigInt(partialEnd) : 0n;
        const unit = zoneUnit(gapStart);
        onAmountChange(raw <= 0n ? 0n : (raw / unit) * unit);
      }
    };
  }

  // Figma axis runs from the dust floor ("Min.") to the ceiling, so an amount at
  // the floor sits on the empty stub (3015:59627) and the whole bar is live.
  const max = existingDebt + headroom;
  const noHeadroom = headroom <= 0n;
  const disabled = forcedDisabled || noHeadroom;
  const span = max - minBorrow;
  const debtOffset = existingDebt - minBorrow;
  // Left of the tick stages 0, so a debt near the ceiling may squeeze the shaded
  // share: the live zone (tick → ceiling) keeps at least MIN_LIVE_STEPS.
  const naturalTick = span > 0n ? toPosition(debtOffset, span) : 0;
  const tick =
    debtOffset > 0n && naturalTick > STAKE_SLIDER_MAX - MIN_LIVE_STEPS && headroom >= WAD
      ? STAKE_SLIDER_MAX - MIN_LIVE_STEPS
      : naturalTick;
  const stretched = tick !== naturalTick;
  const liveSpan = STAKE_SLIDER_MAX - tick;
  const toBorrowPosition = (total: bigint): number => {
    if (!stretched) return toPosition(total - minBorrow, span);
    if (total <= minBorrow) return 0;
    if (total >= max) return STAKE_SLIDER_MAX;
    if (total <= existingDebt) return Number(((total - minBorrow) * BigInt(tick)) / debtOffset);
    return tick + Number(((total - existingDebt) * BigInt(liveSpan)) / headroom);
  };
  // min == max (3015:59201): a full bar with the amount at the floor.
  const value = disabled || span <= 0n ? STAKE_SLIDER_MAX : toBorrowPosition(existingDebt + amount);
  // An interior tick only; one that rounds onto an end would overlap the end label.
  const marker =
    !disabled && tick > 0 && tick < STAKE_SLIDER_MAX ? { value: existingDebt, position: tick } : undefined;
  // Accrued fees lift a dust-floor debt a few wei above the floor; treat a
  // tick that rounds onto the left end as the floor.
  const onFloor = existingDebt > 0n && tick === 0;
  return {
    value,
    markers: marker ? [marker.position] : [],
    progress: disabled ? 0 : value / (STAKE_SLIDER_MAX / 100),
    disabled,
    hidden: false,
    atFloor: !disabled && onFloor,
    // Nothing borrowable: the ceiling is the current debt (3015:62542).
    axis: { min: minBorrow, max: noHeadroom ? existingDebt : max, marker: marker?.value },
    onValueChange: position => {
      if (disabled || max <= 0n) return;
      if (position >= STAKE_SLIDER_MAX || span <= 0n) {
        onAmountChange(headroom);
        return;
      }
      const unit = stretched ? zoneUnit(headroom) : WAD;
      const raw = stretched
        ? (headroom * BigInt(position - tick)) / BigInt(liveSpan)
        : minBorrow + (span * BigInt(position)) / STEPS - existingDebt;
      let next = raw > 0n ? (raw / unit) * unit : 0n;
      if (next <= 0n) {
        onAmountChange(0n);
        return;
      }
      if (existingDebt === 0n && next < minBorrow) next = minBorrow;
      onAmountChange(next > headroom ? headroom : next);
    }
  };
}
