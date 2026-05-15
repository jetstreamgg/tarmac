import { useMemo } from 'react';
import { formatNumber } from '@/utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { PendleHistoryAction, useFormatDates } from '@/hooks';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';

export type PendleHistoryDisplayRow = {
  id: string;
  txHash: `0x${string}`;
  timestamp: string;
  action: PendleHistoryAction;
  ptAmount: number;
  /** Display label for the row's "X PT-Market" amount text. */
  marketName: string;
};

type Props = {
  rows: PendleHistoryDisplayRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
  dataTestId: string;
};

/**
 * Renderer shared by PendleMarketHistory (single market) and
 * PendleAllMarketsHistory (cross-market overview). Both views format Pendle's
 * BUY_PT / SELL_PT / REDEEM_PY rows identically; only the data source and the
 * market label per row differ — the wrappers project to a uniform shape and
 * hand it here.
 */
export function PendleHistoryRowsTable({ rows, isLoading, error, dataTestId }: Props) {
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => rows?.map(tx => new Date(tx.timestamp)), [rows]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  const history = rows?.map((tx, index) => {
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
      textLeft: `${formatNumber(tx.ptAmount, { compact: true })} ${tx.marketName}`,
      iconLeft,
      formattedDate: formattedDates.length > index ? formattedDates[index] : '',
      rawDate: new Date(tx.timestamp),
      transactionHash: tx.txHash
    };
  });

  return (
    <HistoryTable
      dataTestId={dataTestId}
      history={history}
      error={error}
      isLoading={isLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
