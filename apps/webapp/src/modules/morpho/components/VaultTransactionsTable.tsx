import { useMemo } from 'react';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { useMorphoVaultHistory, getTokenDecimals, TransactionTypeEnum } from '@/hooks';
import { formatBigInt, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash } from '@/components/ui/table-cells';

export type VaultTxFilter = 'all' | 'supply' | 'withdraw';

type VaultTxRow = {
  id: string;
  isSupply: boolean;
  amount: string;
  usd: string;
  symbol: string;
  time: string;
  txHashLabel: string;
  txHref: string;
};

// The vault design's columns: Transaction / Amount / Txn hash / Time (no Status,
// absolute Time column). Column-driven, so it diverges from Savings freely.
const actionCell = (row: VaultTxRow, sublabel?: string) => (
  <CellAction
    icon={row.isSupply ? <ArrowDownToLine className="size-4" /> : <ArrowUpToLine className="size-4" />}
    label={row.isSupply ? <Trans>Supply</Trans> : <Trans>Withdrawal</Trans>}
    sublabel={sublabel}
  />
);

const amountCell = (row: VaultTxRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: row.symbol }} width={12} showChainIcon={false} className="h-3 w-3" />}
    amount={`${row.amount} ${row.symbol}`}
    usd={row.usd}
  />
);

const COLUMNS: ProductTransactionColumn<VaultTxRow>[] = [
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
const renderCard = (row: VaultTxRow) => (
  <TransactionCard
    header={actionCell(row, row.time)}
    fields={[{ label: <Trans>Amount</Trans>, value: amountCell(row) }]}
    link={{ label: <Trans>View transaction</Trans>, href: row.txHref }}
  />
);

/**
 * Morpho vault deposit/withdraw history mapped onto the shared (column-driven)
 * ProductTransactionsTable — the ProductDetailTemplate `transactions` slot.
 * `filter` narrows by action type over the data already fetched (no new source);
 * the no-position page leaves it at `'all'`.
 */
export function VaultTransactionsTable({
  vaultAddress,
  filter = 'all'
}: {
  vaultAddress: `0x${string}`;
  filter?: VaultTxFilter;
}) {
  const { data: history, isLoading, error } = useMorphoVaultHistory({ vaultAddress });

  const rows = useMemo<VaultTxRow[]>(() => {
    if (!history) return [];

    // Each record carries the chain it happened on (normalized for testnets), so
    // the explorer link + decimals stay correct even if the wallet is elsewhere.
    const mapped = history.map(item => {
      const decimals = getTokenDecimals(item.token, item.chainId);
      const amount = formatBigInt(absBigInt(item.assets), { unit: decimals });
      return {
        id: item.transactionHash,
        isSupply: item.type === TransactionTypeEnum.SUPPLY,
        amount,
        usd: `$${amount}`, // vault assets are $1-pegged stablecoins
        symbol: item.token.symbol,
        time: format(item.blockTimestamp, 'MMM d, yyyy, h:mm a'),
        txHashLabel: formatAddress(item.transactionHash, 6, 4),
        txHref: getEtherscanLink(item.chainId, item.transactionHash, 'tx')
      };
    });

    if (filter === 'supply') return mapped.filter(row => row.isSupply);
    if (filter === 'withdraw') return mapped.filter(row => !row.isSupply);
    return mapped;
  }, [history, filter]);

  return (
    <ProductTransactionsTable
      // Remount on filter change so pagination snaps back to page 1.
      key={filter}
      dataTestId="vault-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      rowHref={row => row.txHref}
      isLoading={isLoading}
      error={error}
      renderCard={renderCard}
    />
  );
}
