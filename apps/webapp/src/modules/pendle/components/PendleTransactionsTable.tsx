import { useMemo } from 'react';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { mainnet } from 'wagmi/chains';
import { usePendleMarketHistory, PendleHistoryAction, type PendleMarketConfig } from '@/hooks';
import { formatNumber, getEtherscanLink, formatAddress } from '@/utils';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash } from '@/components/ui/table-cells';

type PendleTxRow = {
  id: string;
  action: PendleHistoryAction;
  amount: string;
  usd: string;
  marketName: string;
  time: string;
  txHashLabel: string;
  txHref: string;
};

const ACTION_LABEL: Record<PendleHistoryAction, React.ReactNode> = {
  [PendleHistoryAction.BUY_PT]: <Trans>Supply</Trans>,
  [PendleHistoryAction.SELL_PT]: <Trans>Withdraw</Trans>,
  [PendleHistoryAction.REDEEM_PY]: <Trans>Redeem</Trans>
};

// Same column shape as the vault table: Transaction / Amount / Txn hash / Time.
const actionCell = (row: PendleTxRow, sublabel?: string) => (
  <CellAction
    icon={
      row.action === PendleHistoryAction.BUY_PT ? (
        <SavingsSupply width={16} height={15} />
      ) : (
        <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
      )
    }
    label={ACTION_LABEL[row.action]}
    sublabel={sublabel}
  />
);

const amountCell = (row: PendleTxRow) => (
  <CellAmount amount={`${row.amount} ${row.marketName}`} usd={row.usd} />
);

const COLUMNS: ProductTransactionColumn<PendleTxRow>[] = [
  {
    id: 'action',
    header: <Trans>Transaction</Trans>,
    width: '1.5fr',
    cell: row => actionCell(row)
  },
  {
    id: 'amount',
    header: <Trans>Amount</Trans>,
    width: '1.5fr',
    cell: amountCell
  },
  {
    id: 'hash',
    header: <Trans>Txn hash</Trans>,
    width: '1fr',
    cell: row => <CellHash label={row.txHashLabel} href={row.txHref} />
  },
  {
    id: 'time',
    header: <Trans>Time</Trans>,
    width: '1.2fr',
    cell: row => <span className="text-textSecondary text-sm">{row.time}</span>
  }
];

// M5 mobile card (Figma 486:20827 pattern): the Time column folds into the
// header subline, the hash becomes the View transaction button.
const renderCard = (row: PendleTxRow) => (
  <TransactionCard
    header={actionCell(row, row.time)}
    fields={[{ label: <Trans>Amount</Trans>, value: amountCell(row) }]}
    link={{ label: <Trans>View transaction</Trans>, href: row.txHref }}
  />
);

/**
 * Per-market Pendle trade history (buy/sell/redeem) mapped onto the shared
 * ProductTransactionsTable — the ProductDetailTemplate `transactions` slot.
 * Rows come from the same PnL feed the legacy history table consumed; Pendle
 * markets are mainnet-only, so explorer links pin to mainnet.
 */
export function PendleTransactionsTable({ market }: { market: PendleMarketConfig }) {
  const { data: history, isLoading, error } = usePendleMarketHistory(market.marketAddress);

  const rows = useMemo<PendleTxRow[]>(() => {
    if (!history) return [];
    return history.map(tx => ({
      id: tx.id,
      action: tx.action,
      amount: formatNumber(tx.ptAmount, { compact: true }),
      usd: `$${formatNumber(Math.abs(tx.valueUsd), { maxDecimals: 2 })}`,
      marketName: market.name,
      time: format(new Date(tx.timestamp), 'MMM d, yyyy, h:mm a'),
      txHashLabel: formatAddress(tx.txHash, 6, 4),
      txHref: getEtherscanLink(mainnet.id, tx.txHash, 'tx')
    }));
  }, [history, market.name]);

  return (
    <ProductTransactionsTable
      dataTestId="pendle-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      isLoading={isLoading}
      error={error}
      renderCard={renderCard}
    />
  );
}
