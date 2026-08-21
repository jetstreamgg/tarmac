/**
 * APP-450 earnings contract: per-protocol and combined "Total earned" /
 * "Earned this month" for the connected wallet. Guiding rule: a wrong number
 * is worse than no number — sources degrade to `notAvailable(reason)`, never
 * to a silently partial figure.
 */

/**
 * One earnings source per supported Morpho vault (Kuba 2026-08-21: every vault
 * ships its PnL; Merkl attribution stays Flagship-only for now). The id embeds
 * the lowercased vault address so per-vault entries stay distinct in missing
 * lists and row lookups.
 */
export type MorphoVaultSourceId = `morpho-vault-${string}`;

export type EarningsSourceId = MorphoVaultSourceId | 'merkl' | 'pendle' | 'savings' | 'stusds';

export const morphoVaultSourceId = (vaultAddress: string): MorphoVaultSourceId =>
  `morpho-vault-${vaultAddress.toLowerCase()}`;

export const isMorphoVaultSourceId = (id: EarningsSourceId): id is MorphoVaultSourceId =>
  id.startsWith('morpho-vault-');

export type TokenAmount = { amount: number; symbol: string };

export type EarningsFigure = {
  usd: number;
  /** Single-token native amount, when the whole figure is one token. */
  native?: TokenAmount;
  /** Multi-token breakdown (Merkl can pay several reward tokens). */
  byToken?: TokenAmount[];
};

export type NotAvailableReason =
  'merkl-monthly-unsupported' | 'source-error' | 'reconciliation-failed' | 'disconnected' | 'loading';

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
  'disconnected',
  // Transient: skeletons cover it, but if it ever renders it must not warn.
  'loading'
]);

export const isAnnouncedGap = (reason: NotAvailableReason): boolean => ANNOUNCED_GAP_REASONS.has(reason);

/** A missing contributor plus why, so the UI can explain the gap it flags. */
export type MissingSourceDetail = {
  id: EarningsSourceId;
  reason: NotAvailableReason;
  /** Display name for sources without a static label (per-vault Morpho entries). */
  label?: string;
};

export type PendleSplit = { realizedUsd: number; markToMarketUsd: number };

/**
 * Coverage caveat: the figure is real but spans less than the row suggests.
 * 'mainnet-only' — the savings row balance aggregates every supported chain,
 * while vaults.fyi only indexes mainnet sUSDS (review finding #3).
 * 'rewards-not-included' — non-Flagship Morpho vaults show vault PnL without
 * their Merkl rewards (per-vault attribution is a follow-up; Kuba 2026-08-21).
 * Always an announced note, never error styling.
 */
export type EarningsCoverage = 'mainnet-only' | 'rewards-not-included';

export type ProtocolEarnings = {
  id: EarningsSourceId;
  /** Display name when the id alone can't label the source (per-vault entries). */
  label?: string;
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
