const SECONDS_PER_DAY = 86_400;

/**
 * Whole days until a PT market's expiry — floored, matching the pendle
 * surfaces' "(ND)" convention, clamped at 0 once matured. One home so the
 * Earn featured card and the pendle product surfaces can't disagree by a day
 * (the featured card used to ceil what every other surface floored).
 */
export const remainingDaysToMaturity = (expirySec: number, nowMs: number): number =>
  Math.max(0, Math.floor((expirySec - Math.floor(nowMs / 1000)) / SECONDS_PER_DAY));
