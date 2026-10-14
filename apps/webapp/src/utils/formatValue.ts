import { formatRay, formatWad, formatCustomDecimals } from './formatUnits';
import { getSupportedNumberLocale } from './localization';

//avoid using 3 decimals (because 1.000 looks like 1 or 1000 depending on language)
const DEFAULT_DECIMALS = 2;
const SMALL_NUM_DECIMALS = 4;

const SMALL_NUM_CUTOFF = 0.1;

type FormatOptions = {
  locale?: string;
  unit?: 'wad' | 'ray' | number;
  compact?: boolean;
  amount?: number;
  maxDecimals?: number;
  /** Pad with trailing zeros up to this many decimals (e.g. 2 → "10,000.00"). */
  minDecimals?: number;
  showPercentageDecimals?: boolean;
  roundingMode?: 'ceil' | 'floor';
  useGrouping?: boolean;
};

export function createNumberFormatter(options?: FormatOptions) {
  const locale = getSupportedNumberLocale(options?.locale);
  const amount = options?.amount ? Math.abs(options?.amount) : undefined;
  const maxDecimals =
    options?.maxDecimals !== undefined
      ? options.maxDecimals
      : amount !== undefined && amount < SMALL_NUM_CUTOFF
        ? SMALL_NUM_DECIMALS
        : DEFAULT_DECIMALS;
  // Amounts pad to two decimals ("50.00", "1,126,587.87") as the comps do;
  // compact figures ("$120.7K") and explicit whole-number caps do not.
  const minDecimals =
    options?.minDecimals ?? (options?.compact ? 0 : Math.min(DEFAULT_DECIMALS, maxDecimals));
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: minDecimals,
    // Intl throws when max < min, so a lone minDecimals wins over the derived max.
    maximumFractionDigits: Math.max(maxDecimals, minDecimals),
    notation: options?.compact ? 'compact' : undefined,
    compactDisplay: options?.compact ? 'short' : undefined,
    roundingMode: options?.roundingMode || undefined,
    useGrouping: options?.useGrouping
  });
}

function createPercentFormatter(options?: FormatOptions) {
  const locale = getSupportedNumberLocale(options?.locale);
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: options?.showPercentageDecimals ? 2 : 0,
    maximumFractionDigits: options?.showPercentageDecimals ? 2 : 0
  });
}

export function formatBigInt(amount: bigint, options?: FormatOptions): string {
  //convert to `${number}`, accounting for decimal units`
  const amountToFormat =
    options?.unit === 'ray'
      ? formatRay(amount)
      : typeof options?.unit === 'number'
        ? formatCustomDecimals(amount, options.unit)
        : formatWad(amount); //assume wad by default
  return formatNumber(parseFloat(amountToFormat), { ...options, amount: parseFloat(amountToFormat) });
}

export function formatNumber(amount: number, options?: FormatOptions): string {
  const absAmount = Math.abs(amount);
  // The "<" clamp steps at the requested precision (0.0001 by default). A
  // whole-number cap has no sub-unit step to clamp to, so it just rounds.
  const clampDecimals = options?.maxDecimals ?? SMALL_NUM_DECIMALS;
  const smallestNumber = 1 / Math.pow(10, clampDecimals);
  const lessThanSmallest = clampDecimals > 0 && absAmount > 0 && absAmount < smallestNumber / 2;
  const amountToFormat = lessThanSmallest ? smallestNumber : amount;
  const result = createNumberFormatter({ ...options, amount: amountToFormat }).format(
    amountToFormat
  ) as `${number}`;
  return lessThanSmallest ? '<' + result : result;
}

/**
 * Splits a number into its grouped integer part and trailing fraction, so a hero
 * value can render the whole part large and the decimals small/dimmed
 * (e.g. `100,000` + `.00026`). Returns an empty `fraction` when there is none.
 */
export function splitAmount(
  value: number,
  fractionDigits = 5,
  options?: {
    /** Off for a live counter, whose fraction must not change width as it ticks. */
    trimTrailingZeros?: boolean;
    /**
     * Off for a live counter: rounding would show a digit the position hasn't
     * earned yet, and would tick half a place out of step with the schedule the
     * counter wakes on.
     */
    round?: boolean;
  }
): { whole: string; fraction: string } {
  const { trimTrailingZeros = true, round = true } = options ?? {};
  const scale = 10 ** fractionDigits;
  // Round once at the scaled-integer level so a fraction that rounds up to a full
  // unit (e.g. 0.999996 → 1) carries into the whole part instead of producing
  // whole "0" / fraction "1".
  const scaled = round ? Math.round(value * scale) : Math.floor(value * scale);
  const whole = Math.trunc(scaled / scale);
  const fractionRaw = scaled - whole * scale;
  const padded = String(fractionRaw).padStart(fractionDigits, '0');
  const fraction = trimTrailingZeros
    ? fractionRaw > 0
      ? padded.replace(/0+$/, '')
      : ''
    : fractionDigits > 0
      ? padded
      : '';
  return { whole: formatNumber(whole, { maxDecimals: 0 }), fraction };
}

export function formatPercent(amount: bigint, options?: FormatOptions): `${number}` {
  // Number is basis points, equivalent to "100%"
  const upperThreshold = 1;

  const amountToFormat = options?.unit === 'ray' ? formatRay(amount) : formatWad(amount);
  const parsedNumToFormat = parseFloat(amountToFormat);

  // Don't use decimal places for 100% or greater
  const showPercentageDecimals = options?.showPercentageDecimals ?? parsedNumToFormat < upperThreshold;

  return createPercentFormatter({ ...options, showPercentageDecimals }).format(
    parsedNumToFormat
  ) as `${number}`;
}

export function formatDecimalPercentage(value: number, decimalPlaces: number = 2): string {
  const percentage = createNumberFormatter({ maxDecimals: decimalPlaces, minDecimals: decimalPlaces }).format(
    value * 100
  );
  return `${percentage}%`;
}

const USD_SMALLEST = 0.01;

/**
 * Money figure with a `$` prefix and exactly two fraction digits, grouped
 * (e.g. `$1,000,000.00`). Unlike {@link formatNumber}, decimals are never
 * dropped — the sign is placed before the symbol (`-$100.00`). A positive
 * amount under half a cent renders as `<$0.01` rather than rounding to a
 * zero that reads as "free"; an exact zero stays `$0.00`, and a negative
 * amount under half a cent rounds to `$0.00` too (no "-<$0.01").
 */
export function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  const belowSmallest = amount > 0 && abs < USD_SMALLEST / 2;
  const sign = amount <= -USD_SMALLEST / 2 ? '-' : '';
  const formatted = new Intl.NumberFormat(getSupportedNumberLocale(), {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(belowSmallest ? USD_SMALLEST : abs);
  return `${sign}${belowSmallest ? '<' : ''}$${formatted}`;
}

/**
 * Protocol-scale money (TVL, liquidity, total supplied) in whole dollars
 * (`$6,610,933,593`): cents on a nine-figure aggregate are noise. Accepts a
 * float or a bigint in `unit` decimals (wad by default).
 */
export function formatWholeUsd(amount: number | bigint, unit: number = 18): string {
  const value = typeof amount === 'bigint' ? parseFloat(formatCustomDecimals(amount, unit)) : amount;
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatNumber(Math.abs(value), { maxDecimals: 0 })}`;
}
