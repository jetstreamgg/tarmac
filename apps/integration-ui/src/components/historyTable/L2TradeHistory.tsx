import { useMemo } from 'react';
import { useL2TradeHistory } from '@jetstreamgg/hooks';
import { formatTradeAmount, useFormatDates } from '@jetstreamgg/utils';
import { HistoryTable } from './HistoryTable';
import { getTokenDecimals } from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';

export function L2TradeHistory() {
  const { data: tradeHistory, isLoading: tradeHistoryLoading, error } = useL2TradeHistory();
  const chainId = useChainId();
  const memoizedDates = useMemo(() => {
    return tradeHistory ? tradeHistory.map(s => s.blockTimestamp) : [];
  }, [tradeHistory]);

  const formattedDates = useFormatDates(memoizedDates || [], 'en-US', 'MMMM d, yyyy, h:mm a');

  const history = tradeHistory?.map((s, index) => ({
    id: s.transactionHash,
    textLeft: formatTradeAmount(s.fromAmount, getTokenDecimals(s.fromToken, chainId)),
    tokenLeft: s.fromToken.symbol,
    textRight: formatTradeAmount(s.toAmount, getTokenDecimals(s.toToken, chainId)),
    tokenRight: s.toToken.symbol,
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: s.blockTimestamp,
    transactionHash: s.transactionHash
  }));

  return (
    <HistoryTable
      history={history}
      error={error}
      isLoading={tradeHistoryLoading}
      transactionHeader={'L2 Trades'}
    />
  );
}
