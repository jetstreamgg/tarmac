/**
 * The Portfolio page's last settled onboarding decision, cached per address
 * (APP-419). A returning wallet renders its callout and default tab from this
 * hint on first paint — frozen for the whole view (fresh data only rewrites
 * the cache, applying on the next mount) — instead of optimistically guessing
 * while the queries load.
 *
 * Lives in lib rather than modules/portfolio because the app shell reads it
 * too (the first-visit AppLoader gates on "no cached decision"), same as
 * earnFilterMemory.
 *
 * The value unions mirror `PortfolioCallout` (modules/portfolio/helpers) and
 * `PortfolioTab` (modules/portfolio/components) structurally; they are inlined
 * here so lib stays below the module layer.
 */

export type PortfolioDecision = {
  outcome: 'none' | 'allocate' | 'simulate';
  tab: 'supplied' | 'idle';
  updatedAt: number;
};

const KEY_PREFIX = 'portfolioDecision:v1:';

/**
 * A decision older than this is treated as absent: after weeks away the
 * balances behind it are stale enough that guessing wrong (and freezing the
 * wrong view) is worse than one loading pass.
 */
export const PORTFOLIO_DECISION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const keyFor = (address: string) => `${KEY_PREFIX}${address.toLowerCase()}`;

const isOutcome = (value: unknown): value is PortfolioDecision['outcome'] =>
  value === 'none' || value === 'allocate' || value === 'simulate';
const isTab = (value: unknown): value is PortfolioDecision['tab'] => value === 'supplied' || value === 'idle';

/** The cached decision for `address`, or null when absent, expired, or unreadable. */
export function readPortfolioDecision(address: string | undefined): PortfolioDecision | null {
  if (!address) return null;
  try {
    const raw = localStorage.getItem(keyFor(address));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { outcome, tab, updatedAt } = parsed as Record<string, unknown>;
    if (!isOutcome(outcome) || !isTab(tab) || typeof updatedAt !== 'number') return null;
    if (Date.now() - updatedAt > PORTFOLIO_DECISION_TTL_MS) {
      localStorage.removeItem(keyFor(address));
      return null;
    }
    return { outcome, tab, updatedAt };
  } catch {
    return null;
  }
}

/** Records the freshly settled decision for `address` (stamps `updatedAt`). */
export function writePortfolioDecision(
  address: string,
  decision: Omit<PortfolioDecision, 'updatedAt'>
): void {
  try {
    localStorage.setItem(
      keyFor(address),
      JSON.stringify({ outcome: decision.outcome, tab: decision.tab, updatedAt: Date.now() })
    );
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}

/**
 * Whether any address has a cached decision. The AppLoader's entry gate reads
 * this before wagmi's reconnect resolves an address, so it can only ask "has
 * this browser ever settled a portfolio" — presence is enough there, so
 * expired entries deliberately still count.
 */
export function hasAnyPortfolioDecision(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(KEY_PREFIX)) return true;
    }
  } catch {
    // fall through — unreadable storage means no usable hint anyway
  }
  return false;
}
