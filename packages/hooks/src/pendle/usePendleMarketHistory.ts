import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PendleHistoryAction } from './constants';
import type {
  PendleHistoryRow,
  PendleMarketHistoryHook,
  PendlePnlTransactionRaw,
  PendleTransactionRaw
} from './pendle';
import { fetchPendleMarketTransactions, fetchPendlePnlTransactions } from './pendleApiClient';

const SURFACED_TRADE_ACTIONS = new Set<string>([PendleHistoryAction.BUY_PT, PendleHistoryAction.SELL_PT]);

function normalizeTrade(tx: PendleTransactionRaw): PendleHistoryRow {
  return {
    id: tx.id,
    txHash: tx.txHash,
    timestamp: tx.timestamp,
    action: tx.action,
    ptAmount: tx.notional?.pt ?? 0,
    valueUsd: tx.value
  };
}

function normalizeRedeem(tx: PendlePnlTransactionRaw): PendleHistoryRow {
  const ptAmount = tx.ptData?.unit ?? 0;
  return {
    id: `${tx.txHash}:${PendleHistoryAction.REDEEM_PY}`,
    txHash: tx.txHash,
    timestamp: tx.timestamp,
    action: PendleHistoryAction.REDEEM_PY,
    ptAmount,
    // Redeems are post-maturity principal returns, not market trades — Pendle
    // doesn't report a `value` for them and computeMaturedEarnings doesn't
    // read this field for redeems (it filters by action first).
    valueUsd: 0
  };
}

/**
 * Fetch + normalize + dedupe + sort the combined v5 trades + v1 PnL feeds for
 * one (market, user) pair. Throws on v5 failure (the primary feed is load-
 * bearing); logs and degrades to trades-only on v1 failure.
 *
 * Exported so the combined-history hook can fan it out across PENDLE_MARKETS.
 */
export async function loadPendleMarketHistoryRows(
  marketAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<PendleHistoryRow[]> {
  const [tradesSettled, pnlSettled] = await Promise.allSettled([
    fetchPendleMarketTransactions(mainnet.id, marketAddress, userAddress),
    fetchPendlePnlTransactions(mainnet.id, marketAddress, userAddress)
  ]);

  if (tradesSettled.status === 'rejected') {
    // Primary feed failed — surface the error rather than half-empty data.
    throw tradesSettled.reason;
  }

  const tradeRows = tradesSettled.value
    .filter(tx => SURFACED_TRADE_ACTIONS.has(tx.action))
    .map(normalizeTrade);

  let redeemRows: PendleHistoryRow[] = [];
  if (pnlSettled.status === 'fulfilled') {
    redeemRows = pnlSettled.value
      .filter(tx => tx.action === PendleHistoryAction.REDEEM_PY)
      .map(normalizeRedeem);
  } else {
    // Don't fail the whole query if the secondary feed is down — log and
    // continue with trades-only. Indexer lag and intermittent 5xx on the
    // PnL endpoint are expected; the user can refetch.
    console.warn('Pendle /pnl/transactions failed, falling back to v5 trades only:', pnlSettled.reason);
  }

  // Dedupe by txHash — defensive only. A trade tx and a redeem tx should
  // never share a hash (different router calls), but if Pendle ever
  // reports the same hash on both feeds, prefer the v5 trade row.
  const seen = new Set<string>();
  const merged: PendleHistoryRow[] = [];
  for (const row of [...tradeRows, ...redeemRows]) {
    const key = row.txHash.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  merged.sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)));
  return merged;
}

/**
 * Hook for fetching the latest market activity for a Pendle market scoped to
 * the connected user. We never show unscoped market activity, so the query
 * is disabled until a wallet is connected.
 *
 * Two endpoints feed this view, fetched in parallel:
 *   - /v5/.../transactions?type=TRADES — primary feed for BUY_PT/SELL_PT,
 *     cheaper, server-side filtered.
 *   - /v1/pnl/transactions — secondary feed, filtered client-side to
 *     redeemPy. The v5 trades endpoint doesn't index post-maturity redeems,
 *     so this is the only place those rows come from.
 *
 * If the PnL call fails the hook degrades to trades-only rather than poisoning
 * the entire history view — the primary feed's correctness shouldn't depend on
 * the supplementary one.
 *
 * Pendle's API doesn't serve Tenderly, so we always query mainnet regardless
 * of the connected chain.
 */
export function usePendleMarketHistory(marketAddress: `0x${string}` | undefined): PendleMarketHistoryHook {
  const { address: userAddress } = useConnection();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendle-market-history', marketAddress?.toLowerCase(), userAddress?.toLowerCase()],
    queryFn: async (): Promise<PendleHistoryRow[]> => {
      if (!marketAddress || !userAddress) return [];
      return loadPendleMarketHistoryRows(marketAddress, userAddress);
    },
    enabled: !!marketAddress && !!userAddress,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  return {
    isLoading,
    data,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Pendle Markets API',
        href: 'https://api-v2.pendle.finance/core/docs',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
