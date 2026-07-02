import { useMemo } from 'react';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { useMorphoVaultHistory, getTokenDecimals, TransactionTypeEnum } from '@/hooks';
import { formatBigInt, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  ProductTransactionsTable,
  ProductTransactionColumn,
  TxActionCell,
  TxAmountCell,
  TxHashLink
} from '@/components/product/ProductTransactionsTable';

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
const COLUMNS: ProductTransactionColumn<VaultTxRow>[] = [
  {
    id: 'action',
    header: <Trans>Transaction</Trans>,
    width: '1.5fr',
    cell: row => (
      <TxActionCell
        icon={
          row.isSupply ? (
            <SavingsSupply width={16} height={15} />
          ) : (
            <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
          )
        }
        label={row.isSupply ? <Trans>Supply</Trans> : <Trans>Withdrawal</Trans>}
      />
    )
  },
  {
    id: 'amount',
    header: <Trans>Amount</Trans>,
    width: '1.5fr',
    cell: row => (
      <TxAmountCell
        icon={
          <TokenIcon token={{ symbol: row.symbol }} width={20} showChainIcon={false} className="h-5 w-5" />
        }
        amount={`${row.amount} ${row.symbol}`}
        usd={row.usd}
      />
    )
  },
  {
    id: 'hash',
    header: <Trans>Txn hash</Trans>,
    width: '1fr',
    cell: row => <TxHashLink label={row.txHashLabel} href={row.txHref} />
  },
  {
    id: 'time',
    header: <Trans>Time</Trans>,
    width: '1.2fr',
    cell: row => <span className="text-textSecondary text-sm">{row.time}</span>
  }
];

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
      isLoading={isLoading}
      error={error}
    />
  );
}
