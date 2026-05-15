import { useMemo } from 'react';
import { useAllPendleMarketsHistory } from '@/hooks';
import { PendleHistoryRowsTable, type PendleHistoryDisplayRow } from './PendleHistoryRowsTable';

/**
 * Combined transaction history across every market in PENDLE_MARKETS. Lives
 * on the overview so users can see activity (including redeems) for matured
 * markets — those markets don't expose a detail pane with PendleMarketHistory,
 * so this is the only place those rows surface.
 */
export function PendleAllMarketsHistory() {
  const { data, isLoading, error } = useAllPendleMarketsHistory();

  const rows = useMemo<PendleHistoryDisplayRow[] | undefined>(
    () => data?.map(tx => ({ ...tx, marketName: tx.market.name })),
    [data]
  );

  return (
    <PendleHistoryRowsTable
      rows={rows}
      isLoading={isLoading}
      error={error}
      dataTestId="pendle-all-markets-history"
    />
  );
}
