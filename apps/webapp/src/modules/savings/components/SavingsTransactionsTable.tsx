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
  ProductTransactionColumn,
  TxStatusBadge,
  TxActionCell,
  TxAmountCell,
  TxHashLink
} from '@/components/product/ProductTransactionsTable';

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
const COLUMNS: ProductTransactionColumn<SavingsTxRow>[] = [
  {
    id: 'action',
    header: <Trans>Action</Trans>,
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
        label={row.isSupply ? <Trans>Supply</Trans> : <Trans>Withdraw</Trans>}
        timeAgo={row.timeAgo}
      />
    )
  },
  {
    id: 'status',
    header: <Trans>Status</Trans>,
    width: '1fr',
    // Confirmed on-chain history only; pending in-flight txs are a later ticket.
    cell: () => <TxStatusBadge status="completed" />
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
        amount={row.amount}
        usd={row.usd}
      />
    )
  },
  {
    id: 'hash',
    header: <Trans>Txn hash</Trans>,
    width: '1fr',
    cell: row => <TxHashLink label={row.txHashLabel} href={row.txHref} />
  }
];

/**
 * Savings history mapped onto the shared (column-driven) ProductTransactionsTable
 * — the ProductDetailTemplate `transactions` slot.
 */
export function SavingsTransactionsTable() {
  const subgraphUrl = useSubgraphUrl();
  const { data: savingsHistory, isLoading, error } = useSavingsHistory(subgraphUrl);
  const chainId = useChainId();

  const rows = useMemo<SavingsTxRow[]>(() => {
    if (!savingsHistory) return [];

    return savingsHistory.map(s => {
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
  }, [savingsHistory, chainId]);

  return (
    <ProductTransactionsTable
      dataTestId="savings-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      isLoading={isLoading}
      error={error}
    />
  );
}
