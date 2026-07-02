import { useMemo } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { TransactionTypeEnum, useRewardsUserHistory, type RewardContract } from '@/hooks';
import { formatBigInt, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { SavingsSupply, ArrowDown, Reward } from '@/modules/icons';
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
const COLUMNS: ProductTransactionColumn<RewardsTxRow>[] = [
  {
    id: 'action',
    header: <Trans>Action</Trans>,
    width: '1.5fr',
    cell: row => (
      <TxActionCell
        icon={
          row.kind === 'supply' ? (
            <SavingsSupply width={16} height={15} />
          ) : row.kind === 'withdraw' ? (
            <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
          ) : (
            <Reward width={14} height={14} />
          )
        }
        label={ACTION_LABELS[row.kind]}
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
 * Per-farm user history mapped onto the shared (column-driven)
 * ProductTransactionsTable — the ProductDetailTemplate `transactions` slot.
 * Supply/withdraw/claim rows come pre-merged and sorted from
 * `useRewardsUserHistory` (subgraph).
 */
export function RewardsTransactionsTable({ contract }: { contract: RewardContract }) {
  const subgraphUrl = useSubgraphUrl();
  const {
    data: history,
    isLoading,
    error
  } = useRewardsUserHistory({ subgraphUrl, rewardContractAddress: contract.contractAddress });

  const rows = useMemo<RewardsTxRow[]>(() => {
    if (!history) return [];

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
  }, [history, contract]);

  return (
    <ProductTransactionsTable
      dataTestId="rewards-transactions"
      columns={COLUMNS}
      rows={rows}
      rowKey={row => row.id}
      isLoading={isLoading}
      error={error}
    />
  );
}
