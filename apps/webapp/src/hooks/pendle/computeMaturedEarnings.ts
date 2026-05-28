// PRD: ralph-workflow/tarmac/prds/pendle-matured-earnings-accuracy/prd.md
//
// Pure earnings math for a matured Pendle PT position. Lives outside the
// hook so the branches are testable without a wagmi harness; the hook is
// the thin wiring layer.
//
// Key decisions:
//   1. Reconciliation gate (1% tolerance, see RECONCILIATION_TOLERANCE):
//      The gate is SYMMETRIC. Pendle's v1 /pnl/transactions feed now
//      surfaces REDEEM_PY rows alongside the v5 /transactions feed's
//      BUY_PT / SELL_PT rows, so `netPtFromPendle = bought − sold −
//      redeemed` is a faithful prediction of the user's on-chain balance.
//      Drift in either direction beyond 1% indicates an untracked
//      transfer (in or out): cost basis is unknown for the unexplained PT,
//      so the line hides. This replaces the slice-02 asymmetric heuristic
//      (which interpreted any shortfall as an implicit redeem and prorated
//      cost basis); the heuristic was correct in spirit but introduced
//      systematic error when the actual cost-per-PT differed from the
//      face-value $1 implied by proration. Real redeem events let us
//      account for realized P&L directly, without proration.
//   2. PT decimals = underlying decimals (Pendle convention): PT tokens
//      are deployed with the same decimal count as their underlying token
//      (PT-sUSDS has 18 because sUSDS has 18; markets with 6-decimal
//      underlyings would have 6-decimal PTs). The caller converts using
//      `market.underlyingDecimals` from PENDLE_MARKETS — NOT a hardcoded
//      1e18 divisor. Per PR #1546 review (commit d37958e5): an earlier
//      draft conflated pyIndex's 1e18 fixed-point scale with PT's own
//      decimal count and silently mis-reconciled balances for 6-decimal
//      markets. The two `1e18` constants in this codebase serve different
//      roles — pyIndex precision (still 18) vs PT decimals (varies per
//      market) — and only the latter belongs at this conversion site.
//   3. APY hidden when sells exist: `daysHeld` derives from the earliest
//      buy, which is only a faithful capital-deployment window for pure
//      buy-and-hold. Any SELL_PT in history biases the rate, so we drop
//      it. REDEEM_PY rows do NOT trigger this — a redeem is the natural
//      end-of-life of a PT position at maturity, not a market-timing
//      exit. Absolute earnings (a sum) remain correct under any pattern.
//      FIFO per-lot age accounting is out of scope per PRD.
//   4. Hide-on-mismatch is safe-correct: a wrong earnings number is
//      worse than no earnings number. The card's `earnings !== undefined`
//      guard skips the line cleanly when this function returns empty.
//   5. Earnings formula (slice 04, replacing slice 02's proration):
//        earnings = finalValue + realizedFromRedeem − netCostUsd
//      where `finalValue` is the chi-converted preview for the still-held
//      PT and `realizedFromRedeem = totalRedeemedPt × multiplier`
//      (multiplier = 1 for pegged markets, chi for sUSDS). Both terms
//      use the SAME multiplier on the same display currency — the
//      redeemed underlying tokens are valued in the current display
//      currency, consistent with how finalValue treats the preview.
//      For sUSDS markets where chi has appreciated since the redeem, this
//      slightly over-credits the user (the redeemed sUSDS may have been
//      withdrawn to USDS at the historical chi). Accepted as a tradeoff:
//      historical-chi accounting would require per-redeem chi snapshots
//      that the v1 feed doesn't currently provide.
//   6. APY uses the cost of the REMAINING (unredeemed) position:
//        costPerPt = netCostUsd / (ptBought − ptSold)
//        costOfRemaining = costPerPt × netPtFromPendle
//      Reflects the rate of return on the capital still deployed in PT,
//      computed as `finalValue / costOfRemaining` annualized. Discount-
//      bought positions show higher APY than at-cost — that's accurate,
//      not a bug, since the user got more PT per dollar.
import { PendleHistoryAction } from './constants';
import type { PendleHistoryRow, PendleMarketConfig } from './pendle';

export type ComputeMaturedEarningsInput = {
  /** Normalized market-history rows from usePendleMarketHistory, scoped to the user. `undefined` while loading. */
  history: PendleHistoryRow[] | undefined;
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
  /**
   * User's on-chain PT balance in PT units (e.g. 1000, not the raw bigint).
   * Caller converts from bigint via
   *   `Number(ptBalance ?? 0n) / 10 ** market.underlyingDecimals`
   * because PT decimals = underlying decimals per Pendle's convention
   * (PT-sUSDS → 18; 6-decimal underlyings would give 6-decimal PTs). See
   * top-of-file note 2 — and do NOT confuse this with the pyIndex `ONE = 1e18`
   * constant the redeem-preview hook uses; those two 18s mean different things.
   */
  ptBalanceFloat: number;
};

export type ComputeMaturedEarningsResult = {
  /** Earnings amount (final value − net cost basis), in `currency` units. */
  earnings?: number;
  /** Annualized yield as a decimal (e.g. 0.0521 for 5.21% APY). */
  apy?: number;
  /** Display symbol for `earnings` (e.g. 'USDS'). */
  currency?: string;
};

const EMPTY: ComputeMaturedEarningsResult = {
  earnings: undefined,
  apy: undefined,
  currency: undefined
};

/**
 * 1% drift between Pendle's reported netPT and the user's on-chain balance.
 * Initial value tuned against rounding/dust loss; revisit after first prod
 * usage data shows where real divergence sits. Tighter risks false hides
 * for legitimate users; looser lets adversarial small-amount transfers slip
 * through the cost-basis story.
 */
const RECONCILIATION_TOLERANCE = 0.01;

/**
 * Returns `{ earnings, apy, currency }` for a matured PT position, or empty
 * values when data is insufficient or the reconciliation gate fails. See the
 * top-of-file block for the design rationale.
 */
export function computeMaturedEarnings({
  history,
  previewAmount,
  chi,
  market,
  effectiveTier,
  ptBalanceFloat
}: ComputeMaturedEarningsInput): ComputeMaturedEarningsResult {
  // No honest math without a USDS-equivalence rule (tx.value is USD, but a
  // non-stable underlying receive amount isn't) — skip earnings entirely.
  if (!effectiveTier) return EMPTY;
  if (!history || previewAmount === undefined) return EMPTY;

  const buys = history.filter(t => t.action === PendleHistoryAction.BUY_PT);
  const sells = history.filter(t => t.action === PendleHistoryAction.SELL_PT);
  const redeems = history.filter(t => t.action === PendleHistoryAction.REDEEM_PY);

  // Reconciliation gate: sum PT across Pendle's view of buys/sells/redeems
  // and compare to what the user actually holds on-chain. usePendleMarketHistory
  // zeros out ptAmount when Pendle's API omits the notional.pt field (or the
  // v1 feed omits txValueAsset for a REDEEM row) — the safe-fallback failure
  // mode, since underestimating either side biases the gate toward hiding.
  const ptBought = buys.reduce((s, t) => s + t.ptAmount, 0);
  const ptSold = sells.reduce((s, t) => s + t.ptAmount, 0);
  const ptRedeemed = redeems.reduce((s, t) => s + t.ptAmount, 0);
  const ptNetTraded = ptBought - ptSold;
  const netPtFromPendle = ptNetTraded - ptRedeemed;
  if (ptBalanceFloat <= 0) return EMPTY;
  // Symmetric gate (see top-of-file decision 1). With REDEEM_PY rows from
  // /v1/pnl/transactions, netPtFromPendle is a faithful prediction of the
  // on-chain balance. Drift > 1% in either direction is an unexplained
  // transfer (in or out); hide.
  if (Math.abs(netPtFromPendle - ptBalanceFloat) > netPtFromPendle * RECONCILIATION_TOLERANCE) {
    return EMPTY;
  }

  const totalSpentUsd = buys.reduce((s, t) => s + t.valueUsd, 0);
  const totalRecoveredUsd = sells.reduce((s, t) => s + t.valueUsd, 0);
  const netCostUsd = totalSpentUsd - totalRecoveredUsd;
  if (netCostUsd <= 0) return EMPTY;

  // Display-currency multiplier: 1 for pegged markets (1 PT = 1 USDS-equivalent
  // underlying = 1 USDS), chi for sUSDS markets (1 PT = 1 sUSDS, then chi
  // converts sUSDS to USDS at the current rate). Applied identically to both
  // the unrealized preview value and the realized redeem value — see decision 5.
  let multiplier: number;
  if (effectiveTier === 'pegged') {
    multiplier = 1;
  } else {
    if (chi === undefined) return EMPTY;
    multiplier = Number(chi) / 1e18;
  }

  const receiveTokens = Number(previewAmount) / 10 ** market.underlyingDecimals;
  const finalValue = receiveTokens * multiplier;
  // Realized value from REDEEM_PY rows. ptAmount on a redeem row IS the
  // underlying received (1 PT = 1 underlying at maturity, per the v1 feed
  // normalizer). Convert to display currency with the same multiplier.
  const realizedFromRedeem = ptRedeemed * multiplier;

  // When the market is genuinely USDS-equivalent (tier 1 or 2), label as USDS.
  // When the line is rendering only because the caller coerced a tier-3 market
  // into 'pegged' (Tenderly TEMP path), label with the underlying symbol so
  // the unit shown matches the receive token.
  const currency = market.usdsEquivalence ? 'USDS' : market.underlyingSymbol;
  const earnings = finalValue + realizedFromRedeem - netCostUsd;

  // APY is the rate of return on the REMAINING (unredeemed) position. We
  // attribute cost basis proportionally — every traded PT shares the same
  // average cost — and compare against the current preview value of what's
  // still held. The realized redeem portion contributes to absolute earnings
  // but doesn't enter the APY ratio: redeems realize at face value, not at
  // a market rate, so including them would bias the rate toward 0% for any
  // position that redeemed early. Discount-bought positions show a higher
  // APY than at-cost ones — that's accurate, not a bug.
  const costPerPt = ptNetTraded > 0 ? netCostUsd / ptNetTraded : 0;
  const costOfRemaining = costPerPt * netPtFromPendle;

  const earliestBuyTimestamp = Math.min(...buys.map(t => Number(new Date(t.timestamp)) / 1000));
  const daysHeld = (market.expiry - earliestBuyTimestamp) / 86_400;
  // APY policy: only report a rate for pure buy-and-hold positions.
  // `daysHeld` uses `earliestBuyTimestamp`, which is only a faithful capital-
  // deployment window when the user never sold. With any SELL_PT in history,
  // capital wasn't continuously deployed across that window — the rate would
  // be biased low. REDEEM_PY rows don't bias the rate (the redeem closes a
  // portion of the position at face value at maturity, which is the natural
  // end-of-life). FIFO per-lot age accounting is out of scope (PRD), so the
  // honest UX is to hide the rate while still showing absolute earnings.
  //
  // Sub-day guard: `daysHeld >= 1` (not just `> 0`). Annualizing a sub-day
  // hold via Math.pow(ratio, 365/daysHeld) either overflows to Infinity for
  // ratios > ~1.005, or produces UX-meaningless rates like 1000%+ for tiny
  // gains compounded across a fictional 1460-period year. Real case that
  // surfaced this: buying PT a few hours before market maturity. Earnings
  // still display; just no annualized rate.
  const apy =
    sells.length === 0 && daysHeld >= 1 && costOfRemaining > 0
      ? Math.pow(finalValue / costOfRemaining, 365 / daysHeld) - 1
      : undefined;

  return { earnings, apy, currency };
}
