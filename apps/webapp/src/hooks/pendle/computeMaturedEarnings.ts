// PRD: ralph-workflow/tarmac/prds/pendle-matured-earnings-accuracy/prd.md
//
// Pure earnings math for a matured Pendle PT position. Lives outside the
// hook so the branches are testable without a wagmi harness; the hook is
// the thin wiring layer.
//
// Key decisions:
//   1. Reconciliation gate (1% tolerance, see RECONCILIATION_TOLERANCE):
//      The gate is ASYMMETRIC. Pendle's TRADES API indexes BUY_PT/SELL_PT
//      only — post-maturity redeems (redeemPyToToken via Pendle's router)
//      reduce on-chain PT balance but do NOT appear in trade history. So
//      we split the two directions of deviation:
//        - Excess PT on-chain (balance > netPt * 1.01): user has PT that
//          Pendle's view doesn't account for — transferred-in, gifted-to,
//          secondary-market, or pagination overflow past the API's
//          100-trade cap. Cost basis is unknown for the surplus → hide.
//        - Shortfall on-chain (balance < netPt): user redeemed some of
//          their PT post-maturity. The remaining position's cost basis
//          is recoverable by proration (see decision 5). Show the line.
//      Within ±1% in either direction the proration math collapses to
//      the un-prorated happy-path identity via the Math.min(1, ratio)
//      cap, so existing buy-and-hold cases are unchanged. Per PR #1546
//      review: reviewer's PT-sENA test position kept failing the prior
//      symmetric gate because they had been making small redeems.
//   2. PT decimals = underlying decimals (Pendle convention): PT tokens
//      are deployed with the same decimal count as their underlying token
//      (PT-USDG has 6 because USDG has 6; PT-sUSDS has 18 because sUSDS
//      has 18). The caller converts using `market.underlyingDecimals`
//      from PENDLE_MARKETS — NOT a hardcoded 1e18 divisor. Per PR #1546
//      review (commit d37958e5): an earlier draft conflated pyIndex's
//      1e18 fixed-point scale with PT's own decimal count and silently
//      mis-reconciled PT-USDG balances. The two `1e18` constants in this
//      codebase serve different roles — pyIndex precision (still 18) vs
//      PT decimals (varies per market) — and only the latter belongs at
//      this conversion site.
//   3. APY hidden when sells exist: `daysHeld` derives from the earliest
//      buy, which is only a faithful capital-deployment window for pure
//      buy-and-hold. Any SELL_PT in history biases the rate, so we drop
//      it. Absolute earnings (a sum) remain correct under any pattern.
//      FIFO per-lot age accounting is out of scope per PRD. Note that
//      redeems don't create SELL_PT entries, so a "buy + redeem" user
//      still gets an APY; a "buy + sell + redeem" user does not.
//   4. Hide-on-mismatch is safe-correct: a wrong earnings number is
//      worse than no earnings number. The card's `earnings !== undefined`
//      guard skips the line cleanly when this function returns empty.
//   5. Redeem handling via prorated cost basis (PR #1546 review,
//      review-fix slice 02): when Pendle's view exceeds on-chain balance
//      (shortfall), we attribute only the proportional share of net cost
//      basis to the remaining PT. The user paid `netCostUsd` for
//      `netPtFromPendle` PT and still holds `ptBalanceFloat`, so the
//      cost attributable to what they still hold is
//        proratedNetCost = netCostUsd × (ptBalanceFloat / netPtFromPendle)
//      Correct under the REDEEM assumption: the redeemed PT's cost has
//      already been realized as the underlying tokens the redeem
//      deposited into the user's wallet. Slightly overestimates the
//      remaining-position cost if the shortfall is actually a transfer-
//      out (gifted PT to a friend) — a documented edge case accepted as
//      a tradeoff (transfers-out are rare; redeems are common,
//      especially post-maturity). On-chain redeem-event detection would
//      let us distinguish the two; out of scope per PRD.
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
   * (PT-USDG → 6, PT-sUSDS → 18). See top-of-file note 2 — and do NOT confuse
   * this with the pyIndex `ONE = 1e18` constant the redeem-preview hook uses;
   * those two 18s mean different things.
   */
  ptBalanceFloat: number;
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

  // Reconciliation gate: sum PT across Pendle's view of buys/sells and compare
  // to what the user actually holds on-chain. usePendleMarketHistory zeros out
  // ptAmount when Pendle's API omits the notional.pt field — the safe-fallback
  // failure mode, since underestimating PT-in means the gate hides the line.
  const ptBought = buys.reduce((s, t) => s + t.ptAmount, 0);
  const ptSold = sells.reduce((s, t) => s + t.ptAmount, 0);
  const netPtFromPendle = ptBought - ptSold;
  if (ptBalanceFloat <= 0) return EMPTY;
  // Asymmetric check (see top-of-file decision 1). Only hide on EXCESS PT,
  // where the surplus has unknown cost basis. Shortfall is allowed through
  // and interpreted as redeems (decision 5).
  if (netPtFromPendle < ptBalanceFloat * (1 - RECONCILIATION_TOLERANCE)) return EMPTY;

  const totalSpentUsd = buys.reduce((s, t) => s + t.valueUsd, 0);
  const totalRecoveredUsd = sells.reduce((s, t) => s + t.valueUsd, 0);
  const netCostUsd = totalSpentUsd - totalRecoveredUsd;
  if (netCostUsd <= 0) return EMPTY;

  // Prorated cost basis (see top-of-file decision 5). Math.min(1, ratio) is
  // load-bearing for the happy path: when balance ≈ netPt with sub-tolerance
  // drift in either direction, floating-point can push the ratio slightly
  // above 1, which would otherwise inflate the cost basis and reduce displayed
  // earnings. Capping at 1 makes within-tolerance excess collapse to the
  // un-prorated identity. Below 1, proration applies — interpreted as redeem.
  const remainingFraction = Math.min(1, ptBalanceFloat / netPtFromPendle);
  const proratedNetCost = netCostUsd * remainingFraction;

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
  const earnings = finalValue - proratedNetCost;

  const earliestBuyTimestamp = Math.min(...buys.map(t => Number(new Date(t.timestamp)) / 1000));
  const daysHeld = (market.expiry - earliestBuyTimestamp) / 86_400;
  // APY policy: only report a rate for pure buy-and-hold positions.
  // `daysHeld` uses `earliestBuyTimestamp`, which is only a faithful capital-
  // deployment window when the user never sold. With any SELL_PT in history,
  // capital wasn't continuously deployed across that window — the rate would
  // be biased low. FIFO per-lot age accounting is out of scope (PRD), so the
  // honest UX is to hide the rate while still showing absolute earnings
  // (which are a sum and remain correct under any trade pattern). APY uses
  // proratedNetCost so a buy-then-redeem user sees a sensible rate on the
  // remaining position (decision 5).
  //
  // Sub-day guard: `daysHeld >= 1` (not just `> 0`). Annualizing a sub-day
  // hold via Math.pow(ratio, 365/daysHeld) either overflows to Infinity for
  // ratios > ~1.005, or produces UX-meaningless rates like 1000%+ for tiny
  // gains compounded across a fictional 1460-period year. Real case that
  // surfaced this: buying PT a few hours before market maturity. Earnings
  // still display; just no annualized rate.
  const apy =
    sells.length === 0 && daysHeld >= 1 && proratedNetCost > 0
      ? Math.pow(finalValue / proratedNetCost, 365 / daysHeld) - 1
      : undefined;

  return { earnings, apy, currency };
}
