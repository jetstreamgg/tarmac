import { useMemo } from 'react';
import { formatNumber, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { PendleHistoryAction, usePendleMarketHistory, type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
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
    const isBuy = tx.action === PendleHistoryAction.BUY_PT;
    const isRedeem = tx.action === PendleHistoryAction.REDEEM_PY;
    const type = isBuy ? t`Buy` : isRedeem ? t`Redeem` : t`Sell`;
    const iconLeft = isBuy ? (
      <SavingsSupply width={14} height={13} className="mr-4.25 shrink-0" />
    ) : (
      <ArrowDown width={10} height={14} className="mr-4.75 shrink-0 fill-white" />
    );
    return {
      id: tx.id,
      type,
      highlightText: isBuy,
      textLeft: `${formatNumber(tx.ptAmount, { compact: true })} ${market.name}`,
      iconLeft,
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
