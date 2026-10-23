/**
 * A position is "significant" (and the onboarding callouts are suppressed) once
 * it clears this USD floor. Dust deposits/balances shouldn't flip the page out
 * of its promotional state.
 */
export const SIGNIFICANT_BALANCE_USD = 10;

/**
 * Which top-of-page onboarding callout to show:
 * - `none`     — the user already has a meaningful earn position; show nothing.
 * - `allocate` — no earn position, but idle stablecoins worth supplying.
 * - `simulate` — no earn position and nothing idle; show the Sky Savings pitch.
 */
export type PortfolioCallout = 'none' | 'allocate' | 'simulate';

export function portfolioCallout(depositedUsd: number, idleUsd: number): PortfolioCallout {
  if (depositedUsd > SIGNIFICANT_BALANCE_USD) return 'none';
  return idleUsd > SIGNIFICANT_BALANCE_USD ? 'allocate' : 'simulate';
}

/**
 * The settled Portfolio decision cached per address. A matured position needs
 * a claim whatever its size, so it suppresses the pitch and claims Supplied,
 * where its Claim card renders.
 */
export function portfolioDecision(
  depositedUsd: number,
  idleUsd: number,
  hasMatured: boolean
): { outcome: PortfolioCallout; tab: 'supplied' | 'idle' } {
  if (hasMatured) return { outcome: 'none', tab: 'supplied' };
  return {
    outcome: portfolioCallout(depositedUsd, idleUsd),
    tab: depositedUsd <= SIGNIFICANT_BALANCE_USD ? 'idle' : 'supplied'
  };
}
