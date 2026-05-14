import { useMemo } from 'react';
import { parseUnits } from 'viem';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { PendleHistoryAction } from './constants';
import type { PendleCombinedHistoryRow, PendleHistoryHook, PendleHistoryItem } from './pendle';
import { useAllPendleMarketsHistory } from './useAllPendleMarketsHistory';

function mapAction(action: PendleHistoryAction): PendleHistoryItem['type'] {
  if (action === PendleHistoryAction.BUY_PT) return TransactionTypeEnum.PENDLE_BUY;
  if (action === PendleHistoryAction.SELL_PT) return TransactionTypeEnum.PENDLE_SELL;
  return TransactionTypeEnum.PENDLE_REDEEM;
}

function rowToItem(row: PendleCombinedHistoryRow): PendleHistoryItem {
  // We display rows in PT-Market terms ("X PT-USDe") for now: it's unambiguous
  // about what asset was transacted (a Principal Token) regardless of which
  // wallet token funded the buy or received the sell — Pendle's router permits
  // aggregator hops, so the wallet-side token (USDS, USDC, …) often differs
  // from the market's underlying and isn't exposed by either Pendle endpoint.
  //
  // PT decimals = underlying decimals (Pendle convention); for redeems the
  // 1 PT = 1 underlying invariant means ptAmount and the actual underlying
  // received are the same number.
  //
  // Go through `toFixed(decimals)` rather than `value * 10**decimals` — the
  // multiplication overflows Number.MAX_SAFE_INTEGER for any 18-decimal
  // amount over ~9e-3 and silently corrupts the low digits. `toFixed` also
  // guarantees a decimal string (no scientific notation) and clamps the
  // fractional length to what parseUnits accepts.
  const decimals = row.market.underlyingDecimals;
  const assets = parseUnits(row.ptAmount.toFixed(decimals), decimals);
  return {
    blockTimestamp: new Date(row.timestamp),
    transactionHash: row.txHash,
    module: ModuleEnum.PENDLE,
    type: mapAction(row.action),
    chainId: 1,
    assets,
    underlyingDecimals: decimals,
    underlyingSymbol: row.market.name,
    marketName: row.market.name,
    marketAddress: row.market.marketAddress
  };
}

/**
 * Adapts the overview's combined-history hook into the shape the
 * cross-module activity modal expects. Same data source, different field
 * names — keeps the modal's BalancesHistoryItem renderer unaware of Pendle's
 * native row shape and reuses the cache (one tanstack query for both views).
 */
export function usePendleCombinedHistory(): PendleHistoryHook {
  const { data, isLoading, error, mutate, dataSources } = useAllPendleMarketsHistory();

  const adapted = useMemo(() => data?.map(rowToItem), [data]);

  return {
    data: adapted,
    isLoading,
    error,
    mutate,
    dataSources
  };
}
