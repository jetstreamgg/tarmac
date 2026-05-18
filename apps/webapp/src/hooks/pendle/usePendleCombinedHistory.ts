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
  // toString gives the shortest round-tripping form (6143.99 → "6143.99",
  // not toFixed's "6143.989999999..."). Fall back to toFixed only when
  // toString emits scientific notation, which parseUnits rejects.
  const decimals = row.market.underlyingDecimals;
  const str = row.ptAmount.toString();
  const assets = parseUnits(/e/i.test(str) ? row.ptAmount.toFixed(decimals) : str, decimals);
  return {
    blockTimestamp: new Date(row.timestamp),
    transactionHash: row.txHash,
    module: ModuleEnum.PENDLE,
    type: mapAction(row.action),
    chainId: 1,
    assets,
    underlyingDecimals: decimals,
    // "X PT-USDe", not "X USDe" — Pendle's router permits aggregator hops,
    // so the wallet-side token often differs from the market's underlying.
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
