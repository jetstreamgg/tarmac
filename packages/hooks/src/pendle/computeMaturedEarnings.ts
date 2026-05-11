import { PendleTradeAction } from './constants';
import type { PendleMarketConfig, PendleTransactionRaw } from './pendle';

export type ComputeMaturedEarningsInput = {
  /** Trade history from Pendle's API, scoped to the user. `undefined` while loading. */
  history: PendleTransactionRaw[] | undefined;
  /** On-chain redeem preview amount in the market's underlying-token units. `undefined` while loading. */
  previewAmount: bigint | undefined;
  /** sUSDS→USDS conversion factor from `previewRedeem(1e18)`. Only consulted on the sUSDS path. */
  chi: bigint | undefined;
  /** Market config; supplies decimals, expiry, and the underlying symbol for currency selection. */
  market: PendleMarketConfig;
  /**
   * Effective USDS-equivalence tier, possibly coerced by the caller (e.g. testnet
   * coercion of tier-3 markets into 'pegged'). Currency labeling still consults
   * `market.usdsEquivalence` directly so coerced-tier renders use the underlying
   * symbol rather than mislabeling values as USDS.
   */
  effectiveTier: 'pegged' | 'sUSDS' | undefined;
};

export type ComputeMaturedEarningsResult = {
  /** Earnings amount (final value − net cost basis), in `currency` units. */
  earnings?: number;
  /** Annualized yield as a decimal (e.g. 0.0521 for 5.21% APY). */
  apy?: number;
  /** Display symbol for `earnings` (e.g. 'USDS', 'sENA'). */
  currency?: string;
};

const EMPTY: ComputeMaturedEarningsResult = {
  earnings: undefined,
  apy: undefined,
  currency: undefined
};

/**
 * Pure earnings math for a matured PT position. Returns empty values when data
 * is insufficient (no buys → likely transferred-in PT; missing preview or chi
 * → still loading or non-applicable market tier).
 *
 * Lives outside the hook so the branches can be tested without a wagmi
 * harness; the hook is the thin wagmi-wiring layer.
 */
export function computeMaturedEarnings({
  history,
  previewAmount,
  chi,
  market,
  effectiveTier
}: ComputeMaturedEarningsInput): ComputeMaturedEarningsResult {
  // No honest math without a USDS-equivalence rule (tx.value is USD, but a
  // non-stable underlying receive amount isn't) — skip earnings entirely.
  if (!effectiveTier) return EMPTY;
  if (!history || previewAmount === undefined) return EMPTY;

  const buys = history.filter(t => t.action === PendleTradeAction.BUY_PT);
  const sells = history.filter(t => t.action === PendleTradeAction.SELL_PT);
  if (buys.length === 0) return EMPTY;

  const totalSpentUsd = buys.reduce((s, t) => s + t.value, 0);
  const totalRecoveredUsd = sells.reduce((s, t) => s + t.value, 0);
  const netCostUsd = totalSpentUsd - totalRecoveredUsd;
  if (netCostUsd <= 0) return EMPTY;

  const receiveTokens = Number(previewAmount) / 10 ** market.underlyingDecimals;

  let finalValue: number;
  if (effectiveTier === 'pegged') {
    finalValue = receiveTokens;
  } else {
    if (chi === undefined) return EMPTY;
    const usdsPerSusds = Number(chi) / 1e18;
    finalValue = receiveTokens * usdsPerSusds;
  }

  // When the market is genuinely USDS-equivalent (tier 1 or 2), label as USDS.
  // When the line is rendering only because the caller coerced a tier-3 market
  // into 'pegged' (Tenderly TEMP path), label with the underlying symbol so
  // the unit shown matches the receive token.
  const currency = market.usdsEquivalence ? 'USDS' : market.underlyingSymbol;
  const earnings = finalValue - netCostUsd;

  const earliestBuyTimestamp = Math.min(...buys.map(t => Number(new Date(t.timestamp)) / 1000));
  const daysHeld = (market.expiry - earliestBuyTimestamp) / 86_400;
  const apy =
    daysHeld > 0 && netCostUsd > 0 ? Math.pow(finalValue / netCostUsd, 365 / daysHeld) - 1 : undefined;

  return { earnings, apy, currency };
}
