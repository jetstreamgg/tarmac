import { useMemo } from 'react';
import { TransactionTypeEnum, useSealHistory } from '@jetstreamgg/sky-hooks';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';

const mapTypeEnumToColumn = (type: TransactionTypeEnum) => {
  switch (type) {
    case TransactionTypeEnum.OPEN:
      return t`Open position`;
    case TransactionTypeEnum.SEAL:
    case TransactionTypeEnum.SEAL_SKY:
      return t`Seal`;
    case TransactionTypeEnum.UNSEAL:
    case TransactionTypeEnum.UNSEAL_SKY:
      return t`Unseal`;
    case TransactionTypeEnum.SEAL_REWARD:
      return t`Claim rewards`;
    case TransactionTypeEnum.BORROW:
      return t`Borrow`;
    case TransactionTypeEnum.REPAY:
      return t`Repay`;
    case TransactionTypeEnum.SELECT_DELEGATE:
      return t`Select delegate`;
    case TransactionTypeEnum.SELECT_REWARD:
      return t`Select reward`;
    case TransactionTypeEnum.UNSEAL_KICK:
      return t`Unseal kick`;
    default:
      return '';
  }
};

// TODO: Eventually rewards will be claimed for different tokens as well,
// so we would need to fetch the reward token dynamically
const mapTypeEnumToTokenSymbol = (type: TransactionTypeEnum) => {
  switch (type) {
    case TransactionTypeEnum.SEAL:
    case TransactionTypeEnum.UNSEAL:
      return 'MKR';
    case TransactionTypeEnum.SEAL_SKY:
    case TransactionTypeEnum.UNSEAL_SKY:
      return 'SKY';
    case TransactionTypeEnum.BORROW:
    case TransactionTypeEnum.REPAY:
    case TransactionTypeEnum.SEAL_REWARD:
      return 'USDS';
    default:
      return '';
  }
};

const highlightedEvents = [TransactionTypeEnum.SEAL, TransactionTypeEnum.SEAL_SKY, TransactionTypeEnum.REPAY];

export function SealHistory({ index }: { index?: number }) {
  const { data: sealHistory, isLoading: sealHistoryLoading, error } = useSealHistory({ index });
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => sealHistory?.map(s => s.blockTimestamp), [sealHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map seal history to rows
  const history = sealHistory?.map((s, index) => ({
    id: `${s.transactionHash}-${s.type}`,
    type: mapTypeEnumToColumn(s.type),
    highlightText: highlightedEvents.includes(s.type),
    textLeft:
      'amount' in s
        ? `${formatBigInt(s.amount || 0n, { compact: true })} ${mapTypeEnumToTokenSymbol(s.type)}`
        : '',
    iconLeft:
      'amount' in s ? (
        highlightedEvents.includes(s.type) ? (
          <SavingsSupply width={14} height={13} className="mr-1" />
        ) : (
          <ArrowDown width={10} height={14} className="mr-1 fill-white" />
        )
      ) : (
        <></>
      ),
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: s.blockTimestamp,
    transactionHash: s.transactionHash
  }));

  return (
    <HistoryTable
      dataTestId="seal-history"
      history={history}
      error={error}
      isLoading={sealHistoryLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
