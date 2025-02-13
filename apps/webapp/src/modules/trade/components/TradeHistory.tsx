import { useMemo } from 'react';
import { getTokenDecimals, TokenForChain, useTradeHistory } from '@jetstreamgg/hooks';
import { formatNumber, useFormatDates, isL2ChainId } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';

export function TradeHistory() {
  const { data: tradeHistory, isLoading: tradeHistoryLoading, error } = useTradeHistory();
  const chainId = useChainId();
  const { i18n } = useLingui();
  const formatTradeAmount = (input: bigint, decimals: number = 18): string => {
    return formatNumber(parseFloat(formatUnits(input, decimals)), { locale: i18n.locale, compact: true });
  };

  const memoizedDates = useMemo(() => {
    return tradeHistory?.map(s => s.blockTimestamp);
  }, [tradeHistory]);

  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map tradehistory to rows
  const history = tradeHistory?.map((s, index) => ({
    id: s.transactionHash,
    textLeft: formatTradeAmount(s.fromAmount, getTokenDecimals(s.fromToken as TokenForChain, chainId)),
    tokenLeft: s.fromToken.symbol,
    textRight: formatTradeAmount(s.toAmount, getTokenDecimals(s.toToken as TokenForChain, chainId)),
    tokenRight: s.toToken.symbol,
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: s.blockTimestamp,
    transactionHash: s.transactionHash,
    ...('cowOrderStatus' in s ? { cowOrderStatus: s.cowOrderStatus } : {})
  }));

  const isL2 = isL2ChainId(chainId);

  return (
    <HistoryTable
      history={history}
      error={error}
      isLoading={tradeHistoryLoading}
      transactionHeader={t`Trades`}
      statusColumn={!isL2}
      cowExplorerLink={!isL2}
    />
  );
}
