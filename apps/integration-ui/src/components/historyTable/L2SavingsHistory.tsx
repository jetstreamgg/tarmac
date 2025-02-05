import { useMemo } from 'react';
import { useL2SavingsHistory, useSavingsData } from '@jetstreamgg/hooks';
import { formatBigInt, formatTradeAmount, useFormatDates } from '@jetstreamgg/utils';
import { HistoryTable } from './HistoryTable';
import { getTokenDecimals } from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';

export function L2SavingsHistory() {
  const { data: savingsHistory, isLoading: savingsHistoryLoading, error } = useL2SavingsHistory();
  const chainId = useChainId();
  const memoizedDates = useMemo(() => {
    return savingsHistory ? savingsHistory.map(s => s.blockTimestamp) : [];
  }, [savingsHistory]);
  const { data: savingsData } = useSavingsData();

  const formattedDates = useFormatDates(memoizedDates || [], 'en-US', 'MMMM d, yyyy, h:mm a');

  const history = !savingsHistory
    ? []
    : savingsHistory.map((s, index) => ({
        id: s.transactionHash,
        textLeft: formatTradeAmount(s.assets, getTokenDecimals(s.token, chainId)),
        tokenLeft: s.token.symbol,
        textRight: s.type.toLowerCase(),
        tokenRight: '',
        formattedDate: formattedDates.length > index ? formattedDates[index] : '',
        rawDate: s.blockTimestamp,
        transactionHash: s.transactionHash
      }));

  return (
    <>
      <p>User Savings Balance: {formatBigInt(savingsData?.userSavingsBalance || 0n)}</p>
      <p>User NST Balance: {formatBigInt(savingsData?.userNstBalance || 0n)}</p>
      <HistoryTable
        history={history}
        error={error}
        isLoading={savingsHistoryLoading}
        transactionHeader={'L2 Savings'}
      />
    </>
  );
}
