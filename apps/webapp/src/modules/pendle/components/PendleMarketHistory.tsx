import { useMemo } from 'react';
import { formatNumber, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { PendleTradeAction, usePendleMarketHistory, type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';

type PendleMarketHistoryProps = {
  market: PendleMarketConfig;
};

export function PendleMarketHistory({ market }: PendleMarketHistoryProps) {
  const { data: marketHistory, isLoading, error } = usePendleMarketHistory(market.marketAddress);
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => marketHistory?.map(tx => new Date(tx.timestamp)), [marketHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  const history = marketHistory?.map((tx, index) => {
    const isBuy = tx.action === PendleTradeAction.BUY_PT;
    const ptAmount = tx.notional?.pt ?? 0;
    return {
      id: tx.id,
      type: isBuy ? t`Buy` : t`Sell`,
      highlightText: isBuy,
      textLeft: `${formatNumber(ptAmount, { compact: true })} ${market.name}`,
      iconLeft: isBuy ? (
        <SavingsSupply width={14} height={13} className="mr-4.25 shrink-0" />
      ) : (
        <ArrowDown width={10} height={14} className="mr-4.75 shrink-0 fill-white" />
      ),
      formattedDate: formattedDates.length > index ? formattedDates[index] : '',
      rawDate: new Date(tx.timestamp),
      transactionHash: tx.txHash
    };
  });

  return (
    <HistoryTable
      dataTestId="pendle-market-history"
      history={history}
      error={error}
      isLoading={isLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
