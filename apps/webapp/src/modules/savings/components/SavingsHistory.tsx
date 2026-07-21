import { useMemo } from 'react';
import { formatBigInt, isL2ChainId } from '@/utils';
import { useFormatDates } from '@/hooks';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useIndexerUrl } from '@/modules/app/hooks/useIndexerUrl';
import { useSavingsHistory } from '@/hooks';
import { getTokenDecimals, TransactionTypeEnum } from '@/hooks';
import { useChainId } from 'wagmi';

export function SavingsHistory() {
  const indexerUrl = useIndexerUrl();
  const { data: savingsHistory, isLoading: savingsHistoryLoading, error } = useSavingsHistory(indexerUrl);

  const chainId = useChainId();
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => savingsHistory?.map(s => s.blockTimestamp), [savingsHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map savings history to rows
  const history = savingsHistory?.map((s, index) => ({
    id: s.transactionHash,
    type: s.type === TransactionTypeEnum.SUPPLY ? t`Supply` : t`Withdrawal`,
    highlightText: s.type === TransactionTypeEnum.SUPPLY,
    textLeft: `${formatBigInt(absBigInt(s.assets), { compact: true, unit: isL2ChainId(chainId) ? getTokenDecimals(s.token, chainId) : 18 })} ${isL2ChainId(chainId) ? s.token.symbol : 'USDS'}`,
    iconLeft:
      s.type === TransactionTypeEnum.SUPPLY ? (
        <SavingsSupply width={14} height={13} className="mr-1" />
      ) : (
        <ArrowDown width={10} height={14} className="light:fill-text mr-1 fill-white" />
      ),
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: s.blockTimestamp,
    transactionHash: s.transactionHash
  }));

  return (
    <HistoryTable
      dataTestId="savings-history"
      history={history}
      error={error}
      isLoading={savingsHistoryLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
