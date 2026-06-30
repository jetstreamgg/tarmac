import { formatRay, formatWad, formatCustomDecimals } from './formatUnits';
import { getSupportedNumberLocale } from './localization';

//avoid using 3 decimals (because 1.000 looks like 1 or 1000 depending on language)
const DEFAULT_DECIMALS = 2;
const SMALL_NUM_DECIMALS = 4;
const LARGE_NUM_DECIMALS = 0;
const COMPACT_LARGE_NUM_DECIMALS = 2;

const SMALL_NUM_CUTOFF = 10;
const LARGE_NUM_CUTOFF = 1000;

type FormatOptions = {
  locale?: string;
  unit?: 'wad' | 'ray' | number;
  compact?: boolean;
  amount?: number;
  maxDecimals?: number;
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
      : amount === undefined
        ? DEFAULT_DECIMALS
        : amount < SMALL_NUM_CUTOFF
          ? SMALL_NUM_DECIMALS
          : amount < LARGE_NUM_CUTOFF
            ? DEFAULT_DECIMALS
            : options?.compact
              ? COMPACT_LARGE_NUM_DECIMALS
              : LARGE_NUM_DECIMALS;
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
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
  // If the maxDecimals is provided, set the smallestNumber with that amount of decimals
  const smallestNumber = 1 / Math.pow(10, options?.maxDecimals || SMALL_NUM_DECIMALS); //0.0001 if SMALL_NUM_DECIMALS is 4
  const lessThanSmallest = absAmount > 0 && absAmount < smallestNumber / 2;
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
export function splitAmount(value: number, fractionDigits = 5): { whole: string; fraction: string } {
  const scale = 10 ** fractionDigits;
  // Round once at the scaled-integer level so a fraction that rounds up to a full
  // unit (e.g. 0.999996 → 1) carries into the whole part instead of producing
  // whole "0" / fraction "1".
  const scaled = Math.round(value * scale);
  const whole = Math.trunc(scaled / scale);
  const fractionRaw = scaled - whole * scale;
  const fraction =
    fractionRaw > 0 ? String(fractionRaw).padStart(fractionDigits, '0').replace(/0+$/, '') : '';
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
  const percentage = value * 100;
  return `${percentage.toFixed(decimalPlaces)}%`;
}

/**
 * Money figure with a `$` prefix and exactly two fraction digits, grouped
 * (e.g. `$1,000,000.00`). Unlike {@link formatNumber}, decimals are never
 * dropped — the sign is placed before the symbol (`-$100.00`).
 */
export function formatUsd(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat(getSupportedNumberLocale(), {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(Math.abs(amount));
  return `${sign}$${formatted}`;
}

export function formatBigIntAsCeiledAbsoluteWithSymbol(
  amount: bigint,
  unit: number,
  symbol?: string
): string {
  const formattedRoundedDebtValue = formatBigInt(amount, {
    unit,
    useGrouping: false
  });
  const parsedRoundedDebtValue = parseFloat(formattedRoundedDebtValue);
  const regex = /\.[0-9]*[1-9]/;
  const hasDecimalPart = regex.test(formattedRoundedDebtValue);
  const nearestWholeNumber = hasDecimalPart
    ? Math.floor(Math.abs(parsedRoundedDebtValue)) + 1
    : Math.abs(parsedRoundedDebtValue);
  const formattedNumber = formatNumber(nearestWholeNumber);

  return `${formattedNumber}${symbol ? ` ${symbol}` : ''}`;
}
