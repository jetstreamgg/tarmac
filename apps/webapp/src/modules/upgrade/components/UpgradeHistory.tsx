import { useMemo } from 'react';
import { useUpgradeHistory, UpgradeHistoryRow } from '@jetstreamgg/sky-hooks';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';

function formatUpgradeAmount(num: bigint) {
  return formatBigInt(absBigInt(num), { compact: true });
}

function getTokensAndTexts(row: UpgradeHistoryRow) {
  let tokenLeft, tokenRight, amountLeft, amountRight;
  if ('skyAmt' in row) {
    //mkr <> sky
    if (row.mkrAmt > 0) {
      tokenLeft = 'MKR';
      amountLeft = row.mkrAmt;
      tokenRight = 'SKY';
      amountRight = row.skyAmt;
    } else {
      tokenLeft = 'SKY';
      amountLeft = row.skyAmt;
      tokenRight = 'MKR';
      amountRight = row.mkrAmt;
    }
  } else {
    //dai <> usds
    if (row.wad > 0) {
      tokenLeft = 'DAI';
      amountLeft = row.wad;
      tokenRight = 'USDS';
      amountRight = row.wad;
    } else {
      tokenLeft = 'USDS';
      amountLeft = row.wad;
      tokenRight = 'DAI';
      amountRight = row.wad;
    }
  }
  return {
    tokenLeft,
    tokenRight,
    textLeft: formatUpgradeAmount(amountLeft),
    textRight: formatUpgradeAmount(amountRight)
  };
}

export function UpgradeHistory() {
  const subgraphUrl = useSubgraphUrl();
  const {
    data: upgradeHistory,
    isLoading: upgradeHistoryLoading,
    error
  } = useUpgradeHistory({
    subgraphUrl
  });
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => upgradeHistory?.map(u => u.blockTimestamp), [upgradeHistory]);

  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map upgrade history to rows
  const history = upgradeHistory?.map((row, index) => {
    const { tokenLeft, tokenRight, textLeft, textRight } = getTokensAndTexts(row);

    return {
      id: row.transactionHash,
      textLeft,
      tokenLeft,
      textRight,
      tokenRight,
      formattedDate: formattedDates.length > index ? formattedDates[index] : '',
      rawDate: row.blockTimestamp,
      transactionHash: row.transactionHash
    };
  });

  return (
    <HistoryTable
      history={history}
      error={error}
      isLoading={upgradeHistoryLoading}
      transactionHeader={t`Details`}
    />
  );
}
