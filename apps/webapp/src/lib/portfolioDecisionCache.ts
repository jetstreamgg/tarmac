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
// `$` can't appear in an address, so the pointer key never collides.
const LAST_KEY = 'portfolioDecision:v1:$last';

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

/**
 * Records the freshly settled decision for `address` (stamps `updatedAt`),
 * and mirrors it under the `$last` pointer so the landing redirect can read
 * "the outcome of whoever connected here last" synchronously, before wagmi
 * has resolved an address.
 */
export function writePortfolioDecision(
  address: string,
  decision: Omit<PortfolioDecision, 'updatedAt'>
): void {
  try {
    const record = { outcome: decision.outcome, tab: decision.tab, updatedAt: Date.now() };
    localStorage.setItem(keyFor(address), JSON.stringify(record));
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...record, address: address.toLowerCase() }));
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}

/**
 * The last decision written in this browser, whoever it belonged to — the
 * landing redirect's signal. Same TTL and validation as the per-address read.
 */
export function readLastPortfolioDecision(): (PortfolioDecision & { address: string }) | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { outcome, tab, updatedAt, address } = parsed as Record<string, unknown>;
    if (!isOutcome(outcome) || !isTab(tab) || typeof updatedAt !== 'number') return null;
    if (typeof address !== 'string' || !address) return null;
    if (Date.now() - updatedAt > PORTFOLIO_DECISION_TTL_MS) {
      localStorage.removeItem(LAST_KEY);
      return null;
    }
    return { outcome, tab, updatedAt, address };
  } catch {
    return null;
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
