import { useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { wadToFloat, wadToUsd } from '../lib/stakeUsdNotional';
import { formatDistanceToNowStrict } from 'date-fns';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  BP,
  TransactionTypeEnum,
  lsSkySkyRewardAddress,
  lsSkySpkRewardAddress,
  lsSkyUsdsRewardAddress,
  useBreakpointIndex,
  useSkyPrice,
  useStakeHistory
} from '@/hooks';
import { formatAddress, formatUsd, getEtherscanLink } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import {
  ActivityBorrow,
  ActivityRepay,
  ActivityStake,
  ActivityUnstake,
  ClaimRewards,
  Delegate,
  Liquidated,
  SelectRewards,
  StakeSky,
  TransactionsEmpty
} from '@/modules/icons';
import { ExternalLink } from 'lucide-react';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Button } from '@/components/ui/button';
import { StakeEmptySection } from './StakeEmptySection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import { filterTriggerClasses } from '@/components/product/FilterSelect';
import { cn } from '@/lib/cn';
import { CellAction, CellAmount, CellEmpty, CellHash, CellStatus } from '@/components/ui/table-cells';
import { IconboxPosition } from '@/components/ui/iconbox';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { CardField, CardFieldDivider, CardFieldRow } from '@/components/product/CardFields';

/**
 * One row per atomic subgraph event (Figma 3617:24423): a batched transaction
 * shows each of its actions as its own row under the same hash.
 */
export type StakeActivityAction =
  'stake' | 'unstake' | 'borrow' | 'repay' | 'claim' | 'selectDelegate' | 'selectReward' | 'liquidated';

export type StakeActivityToken = 'SKY' | 'USDS' | 'SPK';

export type StakeActivityItem = {
  id: string;
  transactionHash: string;
  blockTimestamp: Date;
  urnIndex?: number;
  action: StakeActivityAction;
  amount?: bigint;
  token?: StakeActivityToken;
};

type StakeActivityInput = {
  type: TransactionTypeEnum;
  transactionHash: string;
  blockTimestamp: Date;
  urnIndex?: number;
  amount?: bigint;
  rewardContract?: string;
  urnAddress?: string;
};

const ACTION_BY_TYPE: Partial<Record<TransactionTypeEnum, StakeActivityAction>> = {
  [TransactionTypeEnum.STAKE_SELECT_DELEGATE]: 'selectDelegate',
  [TransactionTypeEnum.STAKE_SELECT_REWARD]: 'selectReward',
  [TransactionTypeEnum.STAKE]: 'stake',
  [TransactionTypeEnum.STAKE_BORROW]: 'borrow',
  [TransactionTypeEnum.STAKE_REPAY]: 'repay',
  [TransactionTypeEnum.UNSTAKE]: 'unstake',
  [TransactionTypeEnum.STAKE_REWARD]: 'claim',
  [TransactionTypeEnum.UNSTAKE_KICK]: 'liquidated'
};

// Row order inside one transaction, the order the engine applies the calls.
const ACTION_ORDER: StakeActivityAction[] = [
  'selectDelegate',
  'selectReward',
  'stake',
  'borrow',
  'repay',
  'unstake',
  'claim',
  'liquidated'
];

const TOKEN_BY_ACTION: Partial<Record<StakeActivityAction, StakeActivityToken>> = {
  stake: 'SKY',
  unstake: 'SKY',
  liquidated: 'SKY',
  borrow: 'USDS',
  repay: 'USDS'
};

function rewardTokenFor(chainId: number, rewardContract: string | undefined): StakeActivityToken | undefined {
  const address = rewardContract?.toLowerCase();
  if (!address) return undefined;
  const lookup = (map: Record<number, string>) => map[chainId]?.toLowerCase() === address;
  if (lookup(lsSkyUsdsRewardAddress)) return 'USDS';
  if (lookup(lsSkySkyRewardAddress)) return 'SKY';
  if (lookup(lsSkySpkRewardAddress)) return 'SPK';
  return undefined;
}

/**
 * Maps stake-history events to activity rows, newest first. Open-position
 * events are dropped (the batched Stake row already says it); a liquidation
 * finds its position through the urn address. Pure — tested directly.
 */
export function toStakeActivityItems(
  history: readonly StakeActivityInput[] | undefined,
  {
    chainId,
    positions
  }: { chainId: number; positions?: readonly Pick<StakeUserPosition, 'index' | 'urnAddress'>[] }
): StakeActivityItem[] {
  const urnIndexFor = (item: StakeActivityInput) =>
    item.urnIndex ??
    positions?.find(position => position.urnAddress.toLowerCase() === item.urnAddress?.toLowerCase())?.index;

  return (history ?? [])
    .flatMap((item, position) => {
      const action = ACTION_BY_TYPE[item.type];
      if (!action) return [];
      return [
        {
          id: `${item.transactionHash}-${action}-${position}`,
          transactionHash: item.transactionHash,
          blockTimestamp: item.blockTimestamp,
          urnIndex: urnIndexFor(item),
          action,
          amount: item.amount,
          token: action === 'claim' ? rewardTokenFor(chainId, item.rewardContract) : TOKEN_BY_ACTION[action]
        }
      ];
    })
    .sort(
      (a, b) =>
        b.blockTimestamp.getTime() - a.blockTimestamp.getTime() ||
        a.transactionHash.localeCompare(b.transactionHash) ||
        ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action)
    );
}

function actionLabel(action: StakeActivityAction) {
  switch (action) {
    case 'stake':
      return <Trans>Stake</Trans>;
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
  }
}

// Stake, Unstake, Borrow and Repay glyphs come from the comp; the rest have no comp row yet.
function actionIcon(action: StakeActivityAction) {
  switch (action) {
    case 'stake':
      return <ActivityStake width={16} height={16} />;
    case 'unstake':
      return <ActivityUnstake width={16} height={16} />;
    case 'borrow':
      return <ActivityBorrow width={16} height={16} />;
    case 'repay':
      return <ActivityRepay width={16} height={16} />;
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

type ActivityRow = StakeActivityItem & { skyPrice: number | null; chainId: number };

const actionCell = (row: ActivityRow) => (
  <CellAction
    compact
    icon={actionIcon(row.action)}
    // The comp keeps action names on one line; auto layout otherwise squeezes the 200px column.
    label={<span className="whitespace-nowrap">{actionLabel(row.action)}</span>}
    sublabel={formatDistanceToNowStrict(row.blockTimestamp, { addSuffix: true })}
  />
);

// Figma 3617:24438: 20px green token with the sky glyph beside a Label 5 name.
const positionCell = (row: ActivityRow) =>
  row.urnIndex === undefined ? (
    <CellEmpty />
  ) : (
    <span className="text-fgPrimary font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] whitespace-nowrap">
      <IconboxPosition size="xs">
        <StakeSky width={9} height={9} />
      </IconboxPosition>
      <Trans>Position {row.urnIndex + 1}</Trans>
    </span>
  );

function usdValue(row: ActivityRow): string | undefined {
  if (row.amount === undefined) return undefined;
  if (row.token === 'USDS') return formatUsd(wadToFloat(row.amount));
  if (row.token === 'SKY' && row.skyPrice !== null) return formatUsd(wadToUsd(row.amount, row.skyPrice));
  return undefined;
}

const amountCell = (row: ActivityRow) =>
  row.amount === undefined ? (
    <CellEmpty />
  ) : (
    <CellAmount
      icon={
        row.token && (
          <TokenIcon token={{ symbol: row.token }} width={12} className="h-3 w-3" showChainIcon={false} />
        )
      }
      amount={formatStakeAmount(row.amount)}
      usd={usdValue(row)}
    />
  );

// Figma's px widths (824px table) as fr weights; mixing px with fr overflows 100% and squeezes the px columns.
const COLUMNS: ProductTransactionColumn<ActivityRow>[] = [
  {
    id: 'action',
    header: <Trans>Action</Trans>,
    width: '200fr',
    cell: actionCell
  },
  {
    id: 'position',
    header: <Trans>Position ID</Trans>,
    width: '161fr',
    cell: positionCell
  },
  {
    id: 'status',
    header: <Trans>Status</Trans>,
    width: '161fr',
    // Subgraph history is confirmed-only; optimistic pending rows would slot in via this badge.
    cell: () => <CellStatus status="completed" />
  },
  {
    id: 'amount',
    header: <Trans>Amount</Trans>,
    width: '161fr',
    cell: amountCell
  },
  {
    id: 'hash',
    header: <Trans>Txn hash</Trans>,
    width: '141fr',
    cell: row => (
      <CellHash
        label={formatAddress(row.transactionHash, 6, 4)}
        href={getEtherscanLink(row.chainId, row.transactionHash, 'tx')}
      />
    )
  }
];

// Mobile activity card (comp 1222:16770): Label 4 header, Position and Amount as fields.
const renderCard = (row: ActivityRow) => (
  <TransactionCard
    header={
      <CellAction
        icon={actionIcon(row.action)}
        label={actionLabel(row.action)}
        sublabel={formatDistanceToNowStrict(row.blockTimestamp, { addSuffix: true })}
      />
    }
    badge={<CellStatus status="completed" />}
    footer={
      <>
        <CardFieldRow>
          <CardField label={<Trans>Position ID</Trans>}>{positionCell(row)}</CardField>
          <CardFieldDivider className="h-[30px]" />
          <CardField label={<Trans>Amount</Trans>}>{amountCell(row)}</CardField>
        </CardFieldRow>
        <Button asChild variant="secondary" size="m" className="w-full">
          <a
            href={getEtherscanLink(row.chainId, row.transactionHash, 'tx')}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
          >
            <span>
              <Trans>View transaction</Trans>
            </span>
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </>
    }
  />
);

/**
 * "My activity" table (Figma 3617:24423): one row per stake-history event,
 * with a per-position filter. Read-only, confirmed (subgraph) rows only.
 */
export function StakeActivityTable({ positions }: { positions?: StakeUserPosition[] }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const [filter, setFilter] = useState<'all' | number>('all');
  const { data: stakeHistory, isLoading, error, hasNextPage, fetchNextPage } = useStakeHistory();
  const { priceString: skyPriceString } = useSkyPrice();
  const skyPrice = skyPriceString ? parseFloat(skyPriceString) : null;

  const rows = useMemo<ActivityRow[]>(() => {
    const items = toStakeActivityItems(stakeHistory, { chainId, positions });
    const filtered = filter === 'all' ? items : items.filter(item => item.urnIndex === filter);
    return filtered.map(item => ({ ...item, skyPrice, chainId }));
  }, [stakeHistory, filter, skyPrice, chainId, positions]);

  // Comp 3617:23840: with no activity at all the title sits above a dashed
  // box, with no column header row or filter.
  const isEmpty = !isLoading && !error && (stakeHistory?.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <StakeEmptySection
        testId="stake-activity-empty"
        title={<Trans>My activity</Trans>}
        illustration={<TransactionsEmpty aria-hidden />}
      >
        {isConnected ? (
          <Trans>You don&apos;t have any transactions made yet.</Trans>
        ) : (
          <Trans>Connect your wallet to see your activity.</Trans>
        )}
      </StakeEmptySection>
    );
  }

  return (
    // Comp leaves 24px between the title row and the table header from md.
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Phone tier (comp 1222:16962): heading above a full-width pill filter;
          md restores the heading row with the inline trigger. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-4">
        <h3 className="text-text font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
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
              // Phone tier keeps the comp's full-width 44px pill; from md the
              // trigger is the DS Button / Dropdown S the other table filters
              // wear (Figma 1030:59174, APP-443 item 16 — it was borderless).
              className={
                isMobile
                  ? 'border-glassBorder text-text font-circle h-11 w-full shrink-0 justify-between rounded-full border bg-transparent py-0 pr-3 pl-4 text-sm leading-4 font-medium tracking-[-0.28px] transition-colors focus-visible:ring-0'
                  : cn(filterTriggerClasses(), 'shrink-0 transition-colors focus-visible:ring-0')
              }
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
        rowKey={row => row.id}
        rowHref={row => getEtherscanLink(row.chainId, row.transactionHash, 'tx')}
        isLoading={isLoading}
        error={error}
        renderCard={renderCard}
        onPageChange={(page, totalPages) => {
          if (hasNextPage && page >= totalPages) fetchNextPage();
        }}
      />
    </div>
  );
}
