/**
 * Log-uniform scale for the "Simulate earnings" balance slider.
 *
 * The balance range ($50k–$10M) spans more than two orders of magnitude, so a
 * linear slider spends nine tenths of its travel above $1M and crams every
 * realistic balance into the first inch. On this scale each equal slider
 * distance multiplies the balance by the same factor instead of adding the
 * same amount: the first steps move the figure by a few hundred dollars, the
 * last ones by tens of thousands. The slider itself runs over the integer
 * domain 0..STEPS (so keyboard arrows still step), and `stepToBalance` /
 * `balanceToStep` convert to and from dollars.
 *
 * Balances snap to an increment that scales with magnitude, so the figure
 * reads as a round number at every point of the travel; the two ends stay
 * exactly on the labelled bounds.
 */
export const MIN_BALANCE = 50_000;
export const MAX_BALANCE = 10_000_000;
export const INITIAL_BALANCE = 100_000;
/** Integer slider domain 0..STEPS. 250 keeps a single keyboard step at the
 *  bottom of the range (~2.1%, ≈ $1.07k at $50k) about one snap increment. */
export const STEPS = 250;

const RATIO = Math.log(MAX_BALANCE / MIN_BALANCE);

/** Snap increment for a balance: $1k below $100k, $5k below $1M, $50k above. */
export function snapIncrement(balance: number): number {
  if (balance < 100_000) return 1_000;
  if (balance < 1_000_000) return 5_000;
  return 50_000;
}

/** Round a raw balance to its magnitude's increment, clamped to the bounds. */
export function snapBalance(balance: number): number {
  const clamped = Math.min(MAX_BALANCE, Math.max(MIN_BALANCE, balance));
  const increment = snapIncrement(clamped);
  const snapped = Math.round(clamped / increment) * increment;
  return Math.min(MAX_BALANCE, Math.max(MIN_BALANCE, snapped));
}

/** Slider position (0..STEPS) → snapped balance in dollars. */
export function stepToBalance(step: number): number {
  const t = Math.min(STEPS, Math.max(0, step)) / STEPS;
  if (t === 0) return MIN_BALANCE;
  if (t === 1) return MAX_BALANCE;
  return snapBalance(MIN_BALANCE * Math.exp(RATIO * t));
}

/** Balance in dollars → nearest slider position (0..STEPS). */
export function balanceToStep(balance: number): number {
  const clamped = Math.min(MAX_BALANCE, Math.max(MIN_BALANCE, balance));
  return Math.round((STEPS * Math.log(clamped / MIN_BALANCE)) / RATIO);
}

/** Share of the travel covered, 0–100, for the tick scale under the slider. */
export function stepToProgress(step: number): number {
  return (Math.min(STEPS, Math.max(0, step)) / STEPS) * 100;
}
