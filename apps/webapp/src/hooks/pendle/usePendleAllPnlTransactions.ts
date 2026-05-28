import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { PendleHistoryAction, getPendleMarketByAddress } from './constants';
import type { PendleCombinedHistoryRow, PendleMarketConfig, PendlePnlTransactionRaw } from './pendle';
import { fetchPendlePnlTransactionsForUser } from './pendleApiClient';

/**
 * Wire `action` → canonical PendleHistoryAction. `undefined` for actions we
 * don't surface (mintPy, buyYt, sellYt, addLiquidity*, removeLiquidity*,
 * swapPtToYt, swapYtToPt, transfer*, redeem*Rewards, *LimitOrder, …).
 *
 * Pinned to this transport-boundary module so the canonical PendleHistoryAction
 * enum stays uppercase across the rest of the codebase.
 */
function mapWireAction(wireAction: string): PendleHistoryAction | undefined {
  if (wireAction === 'buyPt') return PendleHistoryAction.BUY_PT;
  if (wireAction === 'sellPt') return PendleHistoryAction.SELL_PT;
  if (wireAction === 'redeemPy') return PendleHistoryAction.REDEEM_PY;
  return undefined;
}

/**
 * Resolves the wire `market` field against PENDLE_MARKETS. The /v1/pnl/transactions
 * feed returns the raw address ("0xc5b32…") even though other Pendle endpoints
 * use a "<chainId>-<address>" form — so we accept both. Returns `undefined`
 * for markets we don't support so those rows are filtered out.
 */
function resolveMarket(wireMarket: string): PendleMarketConfig | undefined {
  const dash = wireMarket.indexOf('-');
  const addr = dash >= 0 ? wireMarket.slice(dash + 1) : wireMarket;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return undefined;
  return getPendleMarketByAddress(addr as `0x${string}`);
}

/**
 * Pure transformer: PnL wire rows → normalized rows tagged with their source
 * market, filtered to PENDLE_MARKETS and surfaced actions, sorted desc by
 * timestamp. Rows with missing or non-finite numeric fields are dropped — the
 * /v1/pnl/transactions feed has been observed to omit values for in-flight or
 * just-matured markets, and NaN downstream corrupts both display and the
 * matured-earnings reconciliation gate (NaN <= 0 is false).
 */
export function normalizePendlePnlRows(rows: PendlePnlTransactionRaw[]): PendleCombinedHistoryRow[] {
  const out: PendleCombinedHistoryRow[] = [];
  for (const tx of rows) {
    const action = mapWireAction(tx.action);
    if (action === undefined) continue;
    const market = resolveMarket(tx.market);
    if (!market) continue;
    if (!Number.isFinite(tx.txValueAsset) || !Number.isFinite(tx.assetUsd)) continue;
    if (action !== PendleHistoryAction.REDEEM_PY && !Number.isFinite(tx.effectivePtExchangeRate)) continue;
    // YT-only redeems where no underlying actually moved would render as a
    // confusing "0 USDS Redeem" row; drop them.
    if (action === PendleHistoryAction.REDEEM_PY && !(tx.txValueAsset > 0)) continue;

    const ptAmount =
      action === PendleHistoryAction.REDEEM_PY
        ? tx.txValueAsset
        : tx.txValueAsset * tx.effectivePtExchangeRate;

    out.push({
      id: `${tx.txHash}:${action}`,
      txHash: tx.txHash,
      timestamp: tx.timestamp,
      action,
      ptAmount,
      valueUsd: tx.txValueAsset * tx.assetUsd,
      market
    });
  }
  out.sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)));
  return out;
}

/**
 * Builds the shared TanStack query key. User-only (no chainId/limit/etc.) so
 * the cache stays stable across ephemeral request params and consumers can
 * target it cleanly when they need to invalidate or pre-populate it.
 */
export function pendlePnlQueryKey(user: `0x${string}` | undefined): unknown[] {
  return ['pendle-pnl-transactions', user?.toLowerCase()];
}

/**
 * Internal shared-cache hook backing both usePendleMarketHistory and
 * useAllPendleMarketsHistory. One unfiltered /v1/pnl/transactions call per
 * connected user (flat 8 compute units, regardless of how many markets we
 * track) is Pendle's "recommended way to fetch data". Normalized rows are
 * filtered to PENDLE_MARKETS and the actions we surface
 * (BUY_PT/SELL_PT/REDEEM_PY).
 *
 * NOT exported from hooks/index.ts — the public API stays the per-market and
 * all-markets hooks, both of which read this same cache.
 *
 * Pendle's API doesn't serve Tenderly fork chain IDs; the transport layer
 * rewrites the request to mainnet (Tenderly mirrors mainnet state). The
 * `chainId=1` query param sent to Pendle is therefore hardcoded — any L2
 * expansion would be a deliberate, separate change.
 *
 * Cache behavior intentionally inherits the global React Query defaults
 * (`staleTime: 0`, `refetchOnWindowFocus: true`, `refetchOnMount: true`) so
 * the hook matches every other history hook in the app. Post-tx refresh is
 * triggered explicitly from the widget pane on a ~25s delay — Pendle's PnL
 * indexer lag is empirically ~20s (verified May 2026), much longer than the
 * 1s used elsewhere for our Envio Hyperindex / Morpho-API-backed histories.
 */
export function usePendleAllPnlTransactions(): UseQueryResult<PendleCombinedHistoryRow[]> {
  const { address: userAddress } = useConnection();

  return useQuery({
    queryKey: pendlePnlQueryKey(userAddress),
    queryFn: async (): Promise<PendleCombinedHistoryRow[]> => {
      const raw = await fetchPendlePnlTransactionsForUser(userAddress!, { chainId: mainnet.id });
      return normalizePendlePnlRows(raw);
    },
    enabled: !!userAddress
  });
}
