import { useMemo } from 'react';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { StUsdsProviderType, TransactionTypeEnum, useStUsdsHistory } from '@/hooks';
import { formatBigInt, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash } from '@/components/ui/table-cells';

type StUsdsTxRow = {
  id: string;
  isSupply: boolean;
  viaCurve: boolean;
  amount: string;
  usd: string;
  time: string;
  txHashLabel: string;
  txHref: string;
};

// Same columns as the vault design: Transaction / Amount / Txn hash / Time.
// Curve-routed rows carry a "via Curve" hint under the action label — the
// history hook merges native module events and Curve pool swaps.
const actionCell = (row: StUsdsTxRow, sublabel?: string) => (
  <CellAction
    icon={
      row.isSupply ? (
        <SavingsSupply width={16} height={15} />
      ) : (
        <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
      )
    }
    label={
      <span className="flex items-center gap-1.5">
        {row.isSupply ? <Trans>Supply</Trans> : <Trans>Withdrawal</Trans>}
        {row.viaCurve && (
          <span className="text-textSecondary text-xs">
            <Trans>via Curve</Trans>
          </span>
        )}
      </span>
    }
    sublabel={sublabel}
  />
);

const amountCell = (row: StUsdsTxRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} showChainIcon={false} className="h-3 w-3" />}
    amount={`${row.amount} USDS`}
    usd={row.usd}
  />
);

const COLUMNS: ProductTransactionColumn<StUsdsTxRow>[] = [
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
const renderCard = (row: StUsdsTxRow) => (
  <TransactionCard
    header={actionCell(row, row.time)}
    fields={[{ label: <Trans>Amount</Trans>, value: amountCell(row) }]}
    link={{ label: <Trans>View transaction</Trans>, href: row.txHref }}
  />
);

/**
 * stUSDS supply/withdraw history (native module events + Curve pool swaps,
 * merged and provider-tagged by `useStUsdsHistory`) mapped onto the shared
 * column-driven ProductTransactionsTable — the ProductDetailTemplate
 * `transactions` slot.
 */
export function StUsdsTransactionsTable() {
  const { data: history, isLoading, error, hasNextPage, fetchNextPage } = useStUsdsHistory();

  const rows = useMemo<StUsdsTxRow[]>(() => {
    if (!history) return [];
    return history.map(item => {
      const amount = formatBigInt(absBigInt(item.assets), { unit: 18 });
      return {
        id: `${item.transactionHash}-${item.type}`,
        isSupply: item.type === TransactionTypeEnum.SUPPLY,
        viaCurve: item.provider === StUsdsProviderType.CURVE,
        amount,
        usd: `$${amount}`, // USDS is $1-pegged
        time: format(item.blockTimestamp, 'MMM d, yyyy, h:mm a'),
        txHashLabel: formatAddress(item.transactionHash, 6, 4),
        txHref: getEtherscanLink(item.chainId, item.transactionHash, 'tx')
      };
    });
  }, [history]);

  return (
    <ProductTransactionsTable
      dataTestId="stusds-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      isLoading={isLoading}
      error={error}
      renderCard={renderCard}
      onPageChange={(page, totalPages) => {
        if (hasNextPage && page >= totalPages) fetchNextPage();
      }}
    />
  );
}
