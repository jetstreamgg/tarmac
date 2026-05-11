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
  /**
   * User's on-chain PT balance in PT units (e.g. 1000, not 1000n * 10n**18n).
   * Caller converts from bigint via `Number(ptBalance ?? 0n) / 1e18`. The 18-decimal
   * divisor reflects the universal Pendle convention for PT tokens — same constant
   * (`ONE = 1e18`) the redeem-preview hook uses for `pyIndex` math. A future market
   * deploying with non-18-decimal PT would break the reconciliation arithmetic AND
   * the preview math together; revisit when that case appears in PENDLE_MARKETS.
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
 * Pure earnings math for a matured PT position. Returns empty values when data
 * is insufficient OR when Pendle's API view of trade history can't be reconciled
 * with the user's actual on-chain PT balance.
 *
 * The reconciliation gate guards against inflated earnings for users whose PT
 * didn't all come through Pendle's router (transferred from another wallet,
 * bought on a secondary market like Uniswap, partially gifted away) — and
 * incidentally handles >100-trade pagination overflow for free, since missing
 * buys produce a netPT-vs-balance mismatch the same way a transfer would.
 * Hide-on-mismatch is the conservative-correct outcome: a wrong earnings
 * number is worse than no earnings number.
 *
 * Lives outside the hook so the branches can be tested without a wagmi
 * harness; the hook is the thin wagmi-wiring layer.
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

  const buys = history.filter(t => t.action === PendleTradeAction.BUY_PT);
  const sells = history.filter(t => t.action === PendleTradeAction.SELL_PT);

  // Reconciliation gate: sum notional.pt across Pendle's view of buys/sells
  // and compare to what the user actually holds on-chain. A trade missing the
  // notional.pt field (older API versions, malformed entries) contributes 0
  // to the sum — the safe-fallback failure mode, since underestimating PT-in
  // means the gate hides the line. Same outcome we want when the API is
  // genuinely incomplete.
  const ptBought = buys.reduce((s, t) => s + (t.notional?.pt ?? 0), 0);
  const ptSold = sells.reduce((s, t) => s + (t.notional?.pt ?? 0), 0);
  const netPtFromPendle = ptBought - ptSold;
  if (ptBalanceFloat <= 0) return EMPTY;
  if (Math.abs(1 - netPtFromPendle / ptBalanceFloat) >= RECONCILIATION_TOLERANCE) return EMPTY;

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
  // APY policy: only report a rate for pure buy-and-hold positions.
  // `daysHeld` uses `earliestBuyTimestamp`, which is only a faithful capital-
  // deployment window when the user never sold. With any SELL_PT in history,
  // capital wasn't continuously deployed across that window — the rate would
  // be biased low. FIFO per-lot age accounting is out of scope (PRD), so the
  // honest UX is to hide the rate while still showing absolute earnings
  // (which are a sum and remain correct under any trade pattern).
  const apy =
    sells.length === 0 && daysHeld > 0 && netCostUsd > 0
      ? Math.pow(finalValue / netCostUsd, 365 / daysHeld) - 1
      : undefined;

  return { earnings, apy, currency };
}
