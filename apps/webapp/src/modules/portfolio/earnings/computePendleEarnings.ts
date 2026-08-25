import { mainnet } from 'wagmi/chains';
import { PENDLE_MARKETS } from '../../../hooks/pendle/constants';
import type {
  PendleDashboardChainPositionsRaw,
  PendleMarketConfig,
  PendlePnlGainedPositionRaw,
  PendlePnlTransactionRaw
} from '../../../hooks/pendle/pendle';
import {
  notAvailable,
  ok,
  type EarningsFigure,
  type EarningsWindow,
  type Maybe,
  type PendleSplit
} from './types';

export type PendleEarningsInput = {
  /** /v1/pnl/gained positions — ALL chains (the endpoint ignores chainId). */
  gainedPositions: PendlePnlGainedPositionRaw[];
  /** /v1/dashboard/positions/database — per-chain current holdings. */
  dashboardPositions: PendleDashboardChainPositionsRaw[];
  /** Raw /v1/pnl/transactions rows — raw, NOT normalized history rows: the
   * monthly profit lives on LP/reward actions the history view drops. */
  pnlRows: PendlePnlTransactionRaw[];
  window: EarningsWindow;
  /** Defaults to PENDLE_MARKETS; injectable for tests. */
  markets?: PendleMarketConfig[];
};

export type PendleEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
  /** Present iff totalEarned is ok — the acceptance-criterion split. */
  pendleSplit?: PendleSplit;
};

/** Wire market references come as "0x…" or "<chainId>-0x…"; normalize to the bare lowercase address. */
const marketAddressOf = (wireMarket: string): string => {
  const dash = wireMarket.indexOf('-');
  return (dash >= 0 ? wireMarket.slice(dash + 1) : wireMarket).toLowerCase();
};

/**
 * PT-sUSDS earnings from Pendle's PnL API, mainnet-scoped to PENDLE_MARKETS.
 *
 * Total = mark-to-market: currentValue − totalSpent + realized, where realized
 * is the API's lifetime netGain (kept after full exits — for a closed position
 * MTM collapses to realized) and currentValue sums pt + yt + lp valuations,
 * matching netGain/totalSpent which cover whole-market activity. USD-only:
 * the dashboard valuations have no native denomination to sum.
 *
 * Monthly = Σ profit.usd over raw transaction rows in the window across ALL
 * actions — netGain and Σ profit are separate API figures and are never mixed.
 * Any in-scope, in-window row with a missing profit or unparseable timestamp
 * degrades the monthly figure; a wrong number is worse than no number.
 *
 * v1 limitation: all endpoints are keyed by the connected wallet as receiver —
 * positions held via smart accounts are out of scope.
 */
export function computePendleEarnings({
  gainedPositions,
  dashboardPositions,
  pnlRows,
  window,
  markets = PENDLE_MARKETS
}: PendleEarningsInput): PendleEarnings {
  const scope = new Set(markets.map(m => m.marketAddress.toLowerCase()));
  const inScope = (chainId: number, wireMarket: string): boolean =>
    chainId === mainnet.id && scope.has(marketAddressOf(wireMarket));

  // --- Monthly: Σ profit over raw rows in the window --------------------------
  const earnedThisMonth: Maybe<EarningsFigure> = (() => {
    let sum = 0;
    for (const row of pnlRows) {
      if (!inScope(row.chainId, row.market)) continue;
      const tSec = Date.parse(row.timestamp) / 1000;
      if (Number.isNaN(tSec)) return notAvailable('reconciliation-failed');
      if (tSec < window.startSec || tSec > window.endSec) continue;
      const profitUsd = row.profit?.usd;
      if (!Number.isFinite(profitUsd)) return notAvailable('reconciliation-failed');
      sum += profitUsd as number;
    }
    return ok({ usd: sum });
  })();

  // --- Total: MTM = currentValue − totalSpent + realized ----------------------
  let realized = 0;
  let totalSpent = 0;
  for (const position of gainedPositions) {
    if (!inScope(position.chainId, position.market)) continue;
    const netGainUsd = position.pnl.netGain.usd;
    const spentUsd = position.pnl.totalSpent.usd;
    if (!Number.isFinite(netGainUsd) || !Number.isFinite(spentUsd)) {
      return { totalEarned: notAvailable('reconciliation-failed'), earnedThisMonth };
    }
    realized += netGainUsd as number;
    totalSpent += spentUsd as number;
  }

  let currentValue = 0;
  for (const chain of dashboardPositions) {
    for (const holding of [...(chain.openPositions ?? []), ...(chain.closedPositions ?? [])]) {
      if (!inScope(chain.chainId, holding.marketId)) continue;
      const valuation = holding.pt.valuation + holding.yt.valuation + holding.lp.valuation;
      if (!Number.isFinite(valuation)) {
        return { totalEarned: notAvailable('reconciliation-failed'), earnedThisMonth };
      }
      currentValue += valuation;
    }
  }

  const pendleSplit: PendleSplit = {
    realizedUsd: realized,
    markToMarketUsd: currentValue - totalSpent + realized
  };

  return {
    totalEarned: ok({ usd: pendleSplit.markToMarketUsd }),
    earnedThisMonth,
    pendleSplit
  };
}
