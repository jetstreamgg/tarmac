import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { useSavingsHistory, getTokenDecimals, TransactionTypeEnum } from '@/hooks';
import { formatBigInt, isL2ChainId, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash, CellStatus } from '@/components/ui/table-cells';
import { SavingsTxFilter } from './SavingsTransactionsFilter';

type SavingsTxRow = {
  id: string;
  isSupply: boolean;
  amount: string;
  usd: string;
  symbol: string;
  timeAgo: string;
  txHashLabel: string;
  txHref: string;
};

// Savings' columns. Other modules define their own — the table is column-driven.
// Single USDS Amount column for now (no historical share data — see APP-300).
const actionCell = (row: SavingsTxRow) => (
  <CellAction
    icon={
      row.isSupply ? (
        <SavingsSupply width={16} height={15} />
      ) : (
        <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
      )
    }
    label={row.isSupply ? <Trans>Supply</Trans> : <Trans>Withdraw</Trans>}
    sublabel={row.timeAgo}
  />
);

const amountCell = (row: SavingsTxRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: row.symbol }} width={12} showChainIcon={false} className="h-3 w-3" />}
    amount={row.amount}
    usd={row.usd}
  />
);

const COLUMNS: ProductTransactionColumn<SavingsTxRow>[] = [
  {
    id: 'action',
    header: <Trans>Action</Trans>,
    width: '1.5fr',
    cell: actionCell
  },
  {
    id: 'status',
    header: <Trans>Status</Trans>,
    width: '1fr',
    // Confirmed on-chain history only; pending in-flight txs are a later ticket.
    cell: () => <CellStatus status="completed" />
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
  }
];

// M5 mobile card of the same row (Figma 486:20827): action cell as the
// header, status as the header badge, hash as the View transaction button.
// The comp's From/To amount pair needs the historical share data we don't
// have yet (APP-300), so the single Amount field stands in.
const renderCard = (row: SavingsTxRow) => (
  <TransactionCard
    header={actionCell(row)}
    badge={<CellStatus status="completed" />}
    fields={[{ label: <Trans>Amount</Trans>, value: amountCell(row) }]}
    link={{ label: <Trans>View transaction</Trans>, href: row.txHref }}
  />
);

/**
 * Savings history mapped onto the shared (column-driven) ProductTransactionsTable
 * — the ProductDetailTemplate `transactions` slot.
 *
 * `filter` narrows by action type over the data already fetched (no new source).
 * It defaults to `'all'`; the no-position page never passes anything else, so its
 * list stays unfiltered.
 */
export function SavingsTransactionsTable({ filter = 'all' }: { filter?: SavingsTxFilter }) {
  const subgraphUrl = useSubgraphUrl();
  const { data: savingsHistory, isLoading, error } = useSavingsHistory(subgraphUrl);
  const chainId = useChainId();

  const rows = useMemo<SavingsTxRow[]>(() => {
    if (!savingsHistory) return [];

    const mapped = savingsHistory.map(s => {
      const decimals = isL2ChainId(chainId) ? getTokenDecimals(s.token, chainId) : 18;
      const amount = formatBigInt(absBigInt(s.assets), { unit: decimals });
      return {
        id: s.transactionHash,
        isSupply: s.type === TransactionTypeEnum.SUPPLY,
        amount,
        usd: `$${amount}`, // USDS ≈ $1
        symbol: isL2ChainId(chainId) ? s.token.symbol : 'USDS',
        timeAgo: formatDistanceToNowStrict(s.blockTimestamp, { addSuffix: true }),
        txHashLabel: formatAddress(s.transactionHash, 6, 4),
        txHref: getEtherscanLink(chainId, s.transactionHash, 'tx')
      };
    });

    if (filter === 'supply') return mapped.filter(row => row.isSupply);
    if (filter === 'withdraw') return mapped.filter(row => !row.isSupply);
    return mapped;
  }, [savingsHistory, chainId, filter]);

  return (
    <ProductTransactionsTable
      // Remount on filter change so pagination snaps back to page 1 (C4) — a
      // changing key resets the table's page state without an effect.
      key={filter}
      dataTestId="savings-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      isLoading={isLoading}
      error={error}
      renderCard={renderCard}
    />
  );
}
