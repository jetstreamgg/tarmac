/**
 * Converts a per-second rate (str) to Annual Percentage Yield (APY)
 * @param str - Per-second yield rate scaled by 1e27 (ray)
 * @returns APY as a percentage (e.g., 5.2 for 5.2%)
 */
export function calculateApyFromStr(str: bigint): number {
  if (str === 0n) return 0;

  const secondsInYear = 365.25 * 24 * 60 * 60;

  // Convert ray to decimal (str is scaled by 1e27)
  // str represents (1 + rate), not just rate
  // So we need to subtract 1e27 to get the actual rate
  const ratePerSecond = (Number(str) - 1e27) / 1e27;

  // Use the compound interest formula: APY = (1 + r)^n - 1
  // This is the correct formula for per-second compounding rates
  try {
    const apy = (Math.pow(1 + ratePerSecond, secondsInYear) - 1) * 100;
    // Safeguard against unrealistic values
    if (!Number.isFinite(apy) || apy > 1000) {
      // Fallback to linear approximation for extreme values
      return ratePerSecond * secondsInYear * 100;
    }
    return apy;
  } catch {
    // Fallback for any calculation errors
    return ratePerSecond * secondsInYear * 100;
  }
}

/**
 * Formats str as APY string with decimals
 * @param str - Per-second yield rate scaled by 1e27 (ray)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted APY string (e.g., "5.20%")
 */
export function formatStrAsApy(str: bigint, decimals: number = 2): string {
  const apy = calculateApyFromStr(str);
  return `${apy.toFixed(decimals)}%`;
}
