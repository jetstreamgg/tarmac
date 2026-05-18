import { useMemo } from 'react';
import { usePendleMarketHistory, type PendleMarketConfig } from '@/hooks';
import { PendleHistoryRowsTable, type PendleHistoryDisplayRow } from './PendleHistoryRowsTable';

type PendleMarketHistoryProps = {
  market: PendleMarketConfig;
};

export function PendleMarketHistory({ market }: PendleMarketHistoryProps) {
  const { data, isLoading, error } = usePendleMarketHistory(market.marketAddress);

  const rows = useMemo<PendleHistoryDisplayRow[] | undefined>(
    () => data?.map(tx => ({ ...tx, marketName: market.name })),
    [data, market.name]
  );

  return (
    <PendleHistoryRowsTable
      rows={rows}
      isLoading={isLoading}
      error={error}
      dataTestId="pendle-market-history"
    />
  );
}
