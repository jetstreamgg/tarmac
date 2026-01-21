import { useMemo } from 'react';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { SavingsSupply, CurveSavingsSupply, CurveSavingsWithdraw, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useStUsdsHistory, StUsdsProviderType } from '@jetstreamgg/sky-hooks';
import { TransactionTypeEnum } from '@jetstreamgg/sky-hooks';

export function StUSDSHistory() {
  const subgraphUrl = useSubgraphUrl();
  const { data: stUsdsHistory, isLoading: stUsdsHistoryLoading, error } = useStUsdsHistory({ subgraphUrl });

  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => stUsdsHistory?.map(s => s.blockTimestamp), [stUsdsHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map stUSDS history to rows
  const history = stUsdsHistory?.map((s, index) => {
    const isCurve = s.provider === StUsdsProviderType.CURVE;
    const isSupply = s.type === TransactionTypeEnum.SUPPLY;

    // Determine the type label
    let typeLabel: string;
    if (isSupply) {
      typeLabel = isCurve ? t`Supply (Curve)` : t`Supply`;
    } else {
      typeLabel = isCurve ? t`Withdrawal (Curve)` : t`Withdrawal`;
    }

    // Determine the icon
    let iconLeft: React.ReactNode;
    if (isSupply) {
      iconLeft = isCurve ? (
        <CurveSavingsSupply width={31} height={26} className="mr-1 -ml-[7px] flex-shrink-0" />
      ) : (
        <SavingsSupply width={14} height={13} className="mr-[17px] flex-shrink-0" />
      );
    } else {
      iconLeft = isCurve ? (
        <CurveSavingsWithdraw width={31} height={26} className="mr-1 -ml-[7px] flex-shrink-0 fill-white" />
      ) : (
        <ArrowDown width={10} height={14} className="mr-[19px] flex-shrink-0 fill-white" />
      );
    }

    return {
      id: s.transactionHash,
      type: typeLabel,
      highlightText: isSupply,
      textLeft: `${formatBigInt(absBigInt(s.assets), { compact: true, unit: 18 })} USDS`,
      iconLeft,
      formattedDate: formattedDates.length > index ? formattedDates[index] : '',
      rawDate: s.blockTimestamp,
      transactionHash: s.transactionHash
    };
  });

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
