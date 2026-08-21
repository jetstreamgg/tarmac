/**
 * APP-450 earnings contract: per-protocol and combined "Total earned" /
 * "Earned this month" for the connected wallet. Guiding rule: a wrong number
 * is worse than no number — sources degrade to `notAvailable(reason)`, never
 * to a silently partial figure.
 */

export type EarningsSourceId = 'morpho-flagship' | 'merkl' | 'pendle' | 'savings' | 'stusds';

export type TokenAmount = { amount: number; symbol: string };

export type EarningsFigure = {
  usd: number;
  /** Single-token native amount, when the whole figure is one token. */
  native?: TokenAmount;
  /** Multi-token breakdown (Merkl can pay several reward tokens). */
  byToken?: TokenAmount[];
};

export type NotAvailableReason =
  | 'merkl-monthly-unsupported'
  | 'stusds-not-listed'
  | 'source-error'
  | 'reconciliation-failed'
  | 'disconnected'
  | 'loading';

export type Maybe<T> = { status: 'ok'; value: T } | { status: 'notAvailable'; reason: NotAvailableReason };

export const ok = <T>(value: T): Maybe<T> => ({ status: 'ok', value });
export const notAvailable = (reason: NotAvailableReason): Maybe<never> => ({
  status: 'notAvailable',
  reason
});

/**
 * Announced gaps are known product limitations (no warning styling in the UI);
 * everything else is an error-class gap (partial-data indicator).
 */
const ANNOUNCED_GAP_REASONS: ReadonlySet<NotAvailableReason> = new Set([
  'merkl-monthly-unsupported',
  'stusds-not-listed',
  'disconnected',
  // Transient: skeletons cover it, but if it ever renders it must not warn.
  'loading'
]);

export const isAnnouncedGap = (reason: NotAvailableReason): boolean => ANNOUNCED_GAP_REASONS.has(reason);

/** A missing contributor plus why, so the UI can explain the gap it flags. */
export type MissingSourceDetail = { id: EarningsSourceId; reason: NotAvailableReason };

export type PendleSplit = { realizedUsd: number; markToMarketUsd: number };

/**
 * Coverage caveat: the figure is correct but spans less than the row's balance
 * does (the savings row balance aggregates every supported chain, while
 * vaults.fyi only indexes mainnet sUSDS — review finding #3).
 */
export type EarningsCoverage = 'mainnet-only';

export type ProtocolEarnings = {
  id: EarningsSourceId;
  /** Marketplace row ids this source contributes to (e.g. 'vault-morpho-0x…'). */
  rowIds: string[];
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
  /** Acceptance criterion: realized vs mark-to-market stay separable. */
  pendleSplit?: PendleSplit;
  /** Set when the source covers less than the row's balance spans. */
  coverage?: EarningsCoverage;
  isLoading: boolean;
  error: Error | null;
};

export type CombinedEarnings = {
  /** Σ over status==='ok' sources only. */
  totalEarnedUsd: number;
  earnedThisMonthUsd: number;
  missingFromTotal: EarningsSourceId[];
  missingFromMonth: EarningsSourceId[];
};

export type EarningsWindow = { startSec: number; endSec: number };

export type WalletEarnings = {
  protocols: ProtocolEarnings[];
  combined: CombinedEarnings;
  isLoading: boolean;
  window: EarningsWindow;
};
