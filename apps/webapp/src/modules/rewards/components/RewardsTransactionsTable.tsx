import { useMemo } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { TransactionTypeEnum, useAllRewardsUserHistory, type RewardContract } from '@/hooks';
import { formatBigInt, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { ClaimRewards } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useIndexerUrl } from '@/modules/app/hooks/useIndexerUrl';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash, CellStatus } from '@/components/ui/table-cells';

type RewardsTxKind = 'supply' | 'withdraw' | 'claim';

type RewardsTxRow = {
  id: string;
  kind: RewardsTxKind;
  amount: string;
  usd?: string;
  symbol: string;
  timeAgo: string;
  txHashLabel: string;
  txHref: string;
};

const ACTION_LABELS: Record<RewardsTxKind, ReturnType<typeof Trans>> = {
  supply: <Trans>Supply</Trans>,
  withdraw: <Trans>Withdraw</Trans>,
  claim: <Trans>Claim</Trans>
};

// Rewards' columns — same shape as Savings' plus a third action type: reward
// claims, denominated in the reward token (no USD subvalue; only the $1-pegged
// supply token doubles as its own USD figure).
const actionCell = (row: RewardsTxRow) => (
  <CellAction
    icon={
      row.kind === 'supply' ? (
        <ArrowDownToLine className="size-4" />
      ) : row.kind === 'withdraw' ? (
        <ArrowUpToLine className="size-4" />
      ) : (
        <ClaimRewards width={16} height={16} />
      )
    }
    label={ACTION_LABELS[row.kind]}
    sublabel={row.timeAgo}
  />
);

const amountCell = (row: RewardsTxRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: row.symbol }} width={12} showChainIcon={false} className="h-3 w-3" />}
    amount={row.amount}
    usd={row.usd}
  />
);

const COLUMNS: ProductTransactionColumn<RewardsTxRow>[] = [
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

// M5 mobile card (Figma 486:20827 pattern): action cell as the header, status
// as the header badge, hash as the View transaction button.
const renderCard = (row: RewardsTxRow) => (
  <TransactionCard
    header={actionCell(row)}
    badge={<CellStatus status="completed" />}
    fields={[{ label: <Trans>Amount</Trans>, value: amountCell(row) }]}
    link={{ label: <Trans>View transaction</Trans>, href: row.txHref }}
  />
);

/**
 * Per-farm user history mapped onto the shared (column-driven)
 * ProductTransactionsTable — the ProductDetailTemplate `transactions` slot.
 * Supply/withdraw/claim rows come pre-merged and sorted from the batched
 * `useAllRewardsUserHistory` (indexer) — one shared query across all farms,
 * filtered down to this contract.
 */
export function RewardsTransactionsTable({ contract }: { contract: RewardContract }) {
  const indexerUrl = useIndexerUrl();
  const {
    data: allHistory,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage
  } = useAllRewardsUserHistory({
    indexerUrl
  });

  const rows = useMemo<RewardsTxRow[]>(() => {
    if (!allHistory) return [];
    const history = allHistory.filter(
      item => item.rewardContractAddress?.toLowerCase() === contract.contractAddress.toLowerCase()
    );

    return history.map((item, index) => {
      const kind: RewardsTxKind =
        item.type === TransactionTypeEnum.REWARD
          ? 'claim'
          : item.type === TransactionTypeEnum.SUPPLY
            ? 'supply'
            : 'withdraw';
      const amount = formatBigInt(absBigInt(item.amount));
      return {
        // A claim can share its tx hash with a supply/withdraw (batched), so the
        // key includes the action + index.
        id: `${item.transactionHash}-${kind}-${index}`,
        kind,
        amount,
        usd: kind === 'claim' ? undefined : `$${amount}`, // supply token ≈ $1
        symbol: kind === 'claim' ? contract.rewardToken.symbol : contract.supplyToken.symbol,
        timeAgo: formatDistanceToNowStrict(item.blockTimestamp, { addSuffix: true }),
        txHashLabel: formatAddress(item.transactionHash, 6, 4),
        txHref: getEtherscanLink(item.chainId ?? contract.chainId, item.transactionHash, 'tx')
      };
    });
  }, [allHistory, contract]);

  return (
    <ProductTransactionsTable
      dataTestId="rewards-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      rowHref={row => row.txHref}
      isLoading={isLoading}
      error={error}
      renderCard={renderCard}
      onPageChange={(page, totalPages) => {
        if (hasNextPage && page >= totalPages) fetchNextPage();
      }}
    />
  );
}
