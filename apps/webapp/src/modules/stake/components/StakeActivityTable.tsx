import { useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { formatDistanceToNowStrict } from 'date-fns';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { TransactionTypeEnum, useSkyPrice, useStakeHistory } from '@/hooks';
import { formatAddress, formatUsd, getEtherscanLink } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import {
  SavingsSupply,
  ArrowDown,
  Stake,
  Delegate,
  Borrow,
  ClaimRewards,
  Liquidated,
  Repaid,
  SelectRewards
} from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { CellAction, CellAmount, CellHash, CellStatus } from '@/components/ui/table-cells';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';

/**
 * The verb taxonomy of the hi-fi activity table (486:31830). The subgraph
 * emits atomic per-call events that share a transaction hash, so combined
 * verbs (Stake & Borrow, Unstake & Repay) come from grouping by hash.
 */
export type StakeActivityVerb =
  | 'stakeBorrow'
  | 'stake'
  | 'unstakeRepay'
  | 'unstake'
  | 'borrow'
  | 'repay'
  | 'claim'
  | 'selectDelegate'
  | 'selectReward'
  | 'open'
  | 'liquidated';

export type StakeActivityGroup = {
  transactionHash: string;
  blockTimestamp: Date;
  urnIndex?: number;
  verb: StakeActivityVerb;
  /** SKY moved (stake or unstake side of the tx). */
  skyAmount: bigint;
  /** USDS moved (borrow or repay side of the tx). */
  usdsAmount: bigint;
};

type StakeActivityInput = {
  type: TransactionTypeEnum;
  transactionHash: string;
  blockTimestamp: Date;
  urnIndex?: number;
  amount?: bigint;
};

function deriveVerb(types: Set<TransactionTypeEnum>): StakeActivityVerb {
  const hasStake = types.has(TransactionTypeEnum.STAKE);
  const hasUnstake = types.has(TransactionTypeEnum.UNSTAKE);
  const hasBorrow = types.has(TransactionTypeEnum.STAKE_BORROW);
  const hasRepay = types.has(TransactionTypeEnum.STAKE_REPAY);

  if (hasStake && hasBorrow) return 'stakeBorrow';
  if (hasUnstake && hasRepay) return 'unstakeRepay';
  if (hasStake) return 'stake';
  if (hasUnstake) return 'unstake';
  if (hasBorrow) return 'borrow';
  if (hasRepay) return 'repay';
  if (types.has(TransactionTypeEnum.UNSTAKE_KICK)) return 'liquidated';
  if (types.has(TransactionTypeEnum.STAKE_REWARD)) return 'claim';
  if (types.has(TransactionTypeEnum.STAKE_SELECT_DELEGATE)) return 'selectDelegate';
  if (types.has(TransactionTypeEnum.STAKE_SELECT_REWARD)) return 'selectReward';
  return 'open';
}

/**
 * Groups atomic stake-history events into one row per transaction and derives
 * the hi-fi verb for the group. Pure — tested directly.
 */
export function groupStakeActivity(history: readonly StakeActivityInput[] | undefined): StakeActivityGroup[] {
  const byHash = new Map<string, StakeActivityInput[]>();
  for (const item of history ?? []) {
    const group = byHash.get(item.transactionHash);
    if (group) group.push(item);
    else byHash.set(item.transactionHash, [item]);
  }

  const sumAmounts = (items: StakeActivityInput[], ...types: TransactionTypeEnum[]) =>
    items.filter(item => types.includes(item.type)).reduce((total, item) => total + (item.amount ?? 0n), 0n);

  return Array.from(byHash.entries())
    .map(([transactionHash, items]) => {
      const types = new Set(items.map(item => item.type));
      const staked = sumAmounts(items, TransactionTypeEnum.STAKE);
      const unstaked = sumAmounts(items, TransactionTypeEnum.UNSTAKE);
      const borrowed = sumAmounts(items, TransactionTypeEnum.STAKE_BORROW);
      const repaid = sumAmounts(items, TransactionTypeEnum.STAKE_REPAY);

      return {
        transactionHash,
        blockTimestamp: items.reduce(
          (latest, item) => (item.blockTimestamp > latest ? item.blockTimestamp : latest),
          items[0].blockTimestamp
        ),
        urnIndex: items.find(item => item.urnIndex !== undefined)?.urnIndex,
        verb: deriveVerb(types),
        skyAmount: staked > 0n ? staked : unstaked,
        usdsAmount: borrowed > 0n ? borrowed : repaid
      };
    })
    .sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

function verbLabel(verb: StakeActivityVerb) {
  switch (verb) {
    case 'stakeBorrow':
      return <Trans>Stake &amp; Borrow</Trans>;
    case 'stake':
      return <Trans>Stake</Trans>;
    case 'unstakeRepay':
      return <Trans>Unstake &amp; Repay</Trans>;
    case 'unstake':
      return <Trans>Unstake</Trans>;
    case 'borrow':
      return <Trans>Borrow</Trans>;
    case 'repay':
      return <Trans>Repay</Trans>;
    case 'claim':
      return <Trans>Claim rewards</Trans>;
    case 'selectDelegate':
      return <Trans>Change delegate</Trans>;
    case 'selectReward':
      return <Trans>Change reward</Trans>;
    case 'liquidated':
      return <Trans>Liquidated</Trans>;
    case 'open':
      return <Trans>Open position</Trans>;
  }
}

// Same glyph family the legacy stake history uses per event type.
function verbIcon(verb: StakeActivityVerb) {
  switch (verb) {
    case 'stakeBorrow':
    case 'open':
      return <Stake width={16} height={16} />;
    case 'stake':
      return <SavingsSupply width={14} height={13} />;
    case 'unstakeRepay':
    case 'unstake':
      return <ArrowDown width={10} height={14} className="light:fill-text fill-white" />;
    case 'borrow':
      return <Borrow width={16} height={16} />;
    case 'repay':
      return <Repaid width={16} height={16} />;
    case 'claim':
      return <ClaimRewards width={16} height={16} />;
    case 'selectDelegate':
      return <Delegate width={16} height={16} />;
    case 'selectReward':
      return <SelectRewards width={16} height={16} />;
    case 'liquidated':
      return <Liquidated width={16} height={16} className="text-error" />;
  }
}

type ActivityRow = StakeActivityGroup & { skyPrice: number | null; chainId: number };

// Figma Type=Action and Position (Transaction Stake): Label 5 title.
const actionCell = (row: ActivityRow) => (
  <CellAction
    compact
    icon={verbIcon(row.verb)}
    label={verbLabel(row.verb)}
    sublabel={
      <>
        {formatDistanceToNowStrict(row.blockTimestamp, { addSuffix: true })}
        {row.urnIndex !== undefined && <> · Position {row.urnIndex + 1}</>}
      </>
    }
  />
);

const skyCell = (row: ActivityRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
    amount={formatStakeAmount(row.skyAmount)}
    usd={row.skyPrice !== null ? formatUsd(Number(formatUnits(row.skyAmount, 18)) * row.skyPrice) : undefined}
  />
);

const usdsCell = (row: ActivityRow) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
    amount={formatStakeAmount(row.usdsAmount)}
    usd={formatUsd(Number(formatUnits(row.usdsAmount, 18)))}
  />
);

const COLUMNS: ProductTransactionColumn<ActivityRow>[] = [
  {
    id: 'action',
    header: <Trans>Action</Trans>,
    width: '1.6fr',
    cell: actionCell
  },
  {
    id: 'status',
    header: <Trans>Status</Trans>,
    width: '1fr',
    // Subgraph history is confirmed-only; optimistic pending rows are an open
    // product decision (Ticket Breakdown) and would slot in via this badge.
    cell: () => <CellStatus status="completed" />
  },
  {
    id: 'sky',
    header: <Trans>Stake/unstake</Trans>,
    width: '1.2fr',
    cell: skyCell
  },
  {
    id: 'usds',
    header: <Trans>Borrow/repay</Trans>,
    width: '1.2fr',
    cell: usdsCell
  },
  {
    id: 'hash',
    header: <Trans>Txn hash</Trans>,
    width: '1fr',
    cell: row => (
      <CellHash
        label={formatAddress(row.transactionHash, 6, 4)}
        href={getEtherscanLink(row.chainId, row.transactionHash, 'tx')}
      />
    )
  }
];

// M5 mobile card (Figma 486:20827 pattern, no stake-specific comp yet —
// flagged on APP-371 for design review): both amount columns become fields.
const renderCard = (row: ActivityRow) => (
  <TransactionCard
    header={actionCell(row)}
    badge={<CellStatus status="completed" />}
    fields={[
      { label: <Trans>Stake/unstake</Trans>, value: skyCell(row) },
      { label: <Trans>Borrow/repay</Trans>, value: usdsCell(row) }
    ]}
    link={{
      label: <Trans>View transaction</Trans>,
      href: getEtherscanLink(row.chainId, row.transactionHash, 'tx')
    }}
  />
);

/**
 * "My activity" table (hi-fi 486:31830): stake history grouped per transaction
 * into the combined verb taxonomy, with a per-position filter. Read-only,
 * confirmed (subgraph) rows only.
 */
export function StakeActivityTable({ positions }: { positions?: StakeUserPosition[] }) {
  const chainId = useChainId();
  const [filter, setFilter] = useState<'all' | number>('all');
  const { data: stakeHistory, isLoading, error } = useStakeHistory();
  const { priceString: skyPriceString } = useSkyPrice();
  const skyPrice = skyPriceString ? parseFloat(skyPriceString) : null;

  const rows = useMemo<ActivityRow[]>(() => {
    const groups = groupStakeActivity(stakeHistory);
    const filtered = filter === 'all' ? groups : groups.filter(group => group.urnIndex === filter);
    return filtered.map(group => ({ ...group, skyPrice, chainId }));
  }, [stakeHistory, filter, skyPrice, chainId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text text-lg font-medium">
          <Trans>My activity</Trans>
        </h3>
        {(positions?.length ?? 0) > 0 && (
          <Select
            value={filter === 'all' ? 'all' : String(filter)}
            onValueChange={next => setFilter(next === 'all' ? 'all' : Number(next))}
          >
            <SelectTrigger
              data-testid="stake-activity-filter"
              aria-label={t`Filter activity by position`}
              className="text-textSecondary hover:text-text h-auto w-auto shrink-0 gap-1.5 rounded-full border-none bg-transparent p-0 text-sm font-medium transition-colors focus-visible:ring-0"
            >
              <SelectValue>
                {filter === 'all' ? <Trans>All positions</Trans> : <Trans>Position {filter + 1}</Trans>}
              </SelectValue>
            </SelectTrigger>
            {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
            <SelectContent>
              <SelectItem value="all" data-testid="stake-activity-filter-all">
                <Trans>All positions</Trans>
              </SelectItem>
              {(positions ?? []).map(position => (
                <SelectItem
                  key={position.index}
                  value={String(position.index)}
                  data-testid={`stake-activity-filter-${position.index}`}
                >
                  <Trans>Position {position.index + 1}</Trans>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ProductTransactionsTable
        // Remount on filter change so pagination snaps back to page 1.
        key={String(filter)}
        dataTestId="stake-activity-table"
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.transactionHash}
        isLoading={isLoading}
        error={error}
        minWidth={720}
        renderCard={renderCard}
        emptyLabel={
          <span data-testid="stake-activity-empty" className="flex flex-col items-center gap-4 py-8">
            <span className="bg-textSecondary/20 h-10 w-10 rounded-full" aria-hidden />
            <Trans>You don&apos;t have any transactions made yet.</Trans>
          </span>
        }
      />
    </div>
  );
}
