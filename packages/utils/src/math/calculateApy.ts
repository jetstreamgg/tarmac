/**
 * Converts a per-second rate (ysr) to Annual Percentage Yield (APY)
 * @param ysr - Per-second yield rate scaled by 1e27 (ray)
 * @returns APY as a percentage (e.g., 5.2 for 5.2%)
 */
export function calculateApyFromYsr(ysr: bigint): number {
  if (ysr === 0n) return 0;

  const secondsInYear = 365.25 * 24 * 60 * 60;

  // Convert ray to decimal (ysr is scaled by 1e27)
  // ysr represents (1 + rate), not just rate
  // So we need to subtract 1e27 to get the actual rate
  const ratePerSecond = (Number(ysr) - 1e27) / 1e27;

  // For small rates, use the approximation: (1 + r)^n ≈ 1 + n*r
  // This avoids overflow issues with Math.pow or Math.exp
  if (Math.abs(ratePerSecond) < 0.0001) {
    // Simple linear approximation for small rates
    const apy = ratePerSecond * secondsInYear * 100;
    return apy;
  }

  // For larger rates, use the compound interest formula
  // APY = (1 + r)^n - 1
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
 * Formats ysr as APY string with decimals
 * @param ysr - Per-second yield rate scaled by 1e27 (ray)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted APY string (e.g., "5.20%")
 */
export function formatYsrAsApy(ysr: bigint, decimals: number = 2): string {
  const apy = calculateApyFromYsr(ysr);
  return `${apy.toFixed(decimals)}%`;
}
