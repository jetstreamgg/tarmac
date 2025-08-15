import { useMemo } from 'react';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useStUsdsHistory } from '@jetstreamgg/sky-hooks';
import { TransactionTypeEnum } from '@jetstreamgg/sky-hooks';

export function StUSDSHistory() {
  const subgraphUrl = useSubgraphUrl();
  const { data: stUsdsHistory, isLoading: stUsdsHistoryLoading, error } = useStUsdsHistory({ subgraphUrl });

  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => stUsdsHistory?.map(s => s.blockTimestamp), [stUsdsHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map stUSDS history to rows
  const history = stUsdsHistory?.map((s, index) => ({
    id: s.transactionHash,
    type: s.type === TransactionTypeEnum.SUPPLY ? t`Supply` : t`Withdrawal`,
    highlightText: s.type === TransactionTypeEnum.SUPPLY,
    textLeft: `${formatBigInt(absBigInt(s.assets), { compact: true, unit: 18 })} USDS`,
    iconLeft:
      s.type === TransactionTypeEnum.SUPPLY ? (
        <SavingsSupply width={14} height={13} className="mr-1" />
      ) : (
        <ArrowDown width={10} height={14} className="mr-1 fill-white" />
      ),
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: s.blockTimestamp,
    transactionHash: s.transactionHash
  }));

  return (
    <HistoryTable
      dataTestId="stusds-history"
      history={history}
      error={error}
      isLoading={stUsdsHistoryLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
