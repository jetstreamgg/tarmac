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

/**
 * toString preserves the user-intended form for short values (6143.99 →
 * "6143.99", parses to 6143_990000000000000000n at 18 decimals) — toFixed
 * would expose IEEE-754 noise. But toString also emits scientific notation
 * for extremes, and `txValueAsset * effectivePtExchangeRate` can produce more
 * fractional digits than the underlying's precision; both crash parseUnits.
 * Fall back to toFixed for scientific notation; truncate excess fractional
 * digits otherwise.
 */
function safeStringifyForParse(value: number, decimals: number): string {
  const str = value.toString();
  if (/e/i.test(str)) return value.toFixed(decimals);
  const dot = str.indexOf('.');
  if (dot < 0) return str;
  // slice(0, dot + decimals + 1) is a no-op when the fractional part is
  // already short enough; otherwise it truncates to the underlying's precision.
  return str.slice(0, dot + decimals + 1);
}

function rowToItem(row: PendleCombinedHistoryRow): PendleHistoryItem {
  const decimals = row.market.underlyingDecimals;
  const assets = parseUnits(safeStringifyForParse(row.ptAmount, decimals) as `${number}`, decimals);
  return {
    blockTimestamp: new Date(row.timestamp),
    transactionHash: row.txHash,
    module: ModuleEnum.PENDLE,
    type: mapAction(row.action),
    chainId: 1,
    assets,
    underlyingDecimals: decimals,
    // "X PT-sUSDS", not "X USDS" — Pendle's router permits aggregator hops,
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
