type SlippageBounds = { min: number; max: number };

export function verifyPendleSlippage(value: string, config: SlippageBounds): string {
  if (value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  if (numeric < config.min) return String(config.min);
  if (numeric > config.max) return String(config.max);
  return value;
}

/** Decimal slippage (e.g. 0.002 for 0.2%) → percentage string for the popover input. */
export function decimalSlippageToPercentString(decimal: number): string {
  return (decimal * 100).toFixed(2).replace(/\.?0+$/, '');
}

/** Percentage string (e.g. "0.5") → decimal slippage (e.g. 0.005). */
export function percentStringToDecimalSlippage(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return 0;
  return n / 100;
}
