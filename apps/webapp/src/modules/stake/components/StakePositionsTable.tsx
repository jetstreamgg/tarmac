import { useCallback, useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import {
  useStakeRewardContracts,
  useRewardContractsToClaim,
  useVault,
  usePrices,
  getIlkName,
  RiskLevel
} from '@/hooks';
import { formatUsd } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { cn } from '@/lib/cn';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky, Liquidated, SuppliedEmpty } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconboxPosition } from '@/components/ui/iconbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskMeter } from '@/components/product/RiskMeter';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard, TransactionCardSkeleton } from '@/components/product/TransactionCard';
import { CardField, CardFieldDivider, CardFieldRow } from '@/components/product/CardFields';
import { CellAmount, CellAmountWithToken, CellChevron, CellPosition } from '@/components/ui/table-cells';
import {
  StakeUserPosition,
  isInactiveStakePosition,
  isLiquidatedStakePosition
} from '../hooks/useStakeUserPositions';
import { StakePositionRowBanner } from './StakePositionRowBanner';

// Liquidation-proximity mapping for the shared risk pill: more (and warmer)
// lit segments = closer to liquidation; rows with no debt render unlit
// (Figma Type=Risk "None"). Colors are the design-system Badges/Risk palette
// (5017:7512) the pill uses everywhere — that node also settles what the 3-lit
// tier is: Orange/600, not red. The pill chrome is the shared RiskMeter
// (review feedback: one pill app-wide).
const RISK_SEGMENTS: Record<RiskLevel, { lit: number; color: string }> = {
  [RiskLevel.LOW]: { lit: 1, color: 'bg-riskLow' },
  [RiskLevel.MEDIUM]: { lit: 2, color: 'bg-riskMedium' },
  [RiskLevel.HIGH]: { lit: 3, color: 'bg-riskHigh' },
  [RiskLevel.LIQUIDATION]: { lit: 3, color: 'bg-riskHigh' }
};

function PositionRiskMeter({ riskLevel }: { riskLevel?: RiskLevel }) {
  const segments = riskLevel ? RISK_SEGMENTS[riskLevel] : undefined;
  return (
    <RiskMeter
      segments={[0, 1, 2].map(index => (segments && index < segments.lit ? segments.color : null))}
    />
  );
}

/** Filled pill badge replacing the risk meter once a position has been liquidated. */
function LiquidatedBadge() {
  return (
    <span
      data-testid="stake-position-liquidated-badge"
      className="bg-error/15 text-error font-circle inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <Liquidated width={16} height={16} />
      <Trans>Liquidation</Trans>
    </span>
  );
}

/** Liquidation-risk cell: liquidated badge, vault risk for urns with debt, or an unlit meter. */
function PositionRiskCell({ position }: { position: StakeUserPosition }) {
  const hasDebt = position.usdsDebt > 0n;
  // The vault read only feeds the risk meter, which is unlit without debt —
  // an undefined urn disables `useVault`'s Vat read for debt-free rows.
  const {
    data: vault,
    isLoading,
    error
  } = useVault(hasDebt ? position.urnAddress : undefined, getIlkName(2));

  const isLiquidated = isLiquidatedStakePosition(position);
  if (isLiquidated) return <LiquidatedBadge />;
  if (hasDebt && isLoading) return <Skeleton className="h-5 w-14" />;
  if (hasDebt && error && !vault) {
    // A failed read on a debt-carrying urn must not render the unlit
    // "no risk" meter — that masks a position that may be near liquidation.
    return (
      <span data-testid="stake-position-risk-unavailable" className="text-textSecondary text-sm">
        –
      </span>
    );
  }
  if (isLiquidated === undefined && isInactiveStakePosition(position)) {
    // No bark history (subgraph down) on an emptied urn: it may be a
    // liquidated one, so neither the badge nor the unlit meter is honest.
    return (
      <span data-testid="stake-position-liquidation-unknown" className="text-textSecondary text-sm">
        –
      </span>
    );
  }
  return <PositionRiskMeter riskLevel={hasDebt ? vault?.riskLevel : undefined} />;
}

/**
 * Borrowed cell: LIVE debt (principal + accrued interest). `position.usdsDebt`
 * is the Vat's `art × rate` from `useStakeUrnVaults` — the same figure
 * `useVault` derives — so no per-row read is needed here.
 */
function PositionBorrowedCell({ position }: { position: StakeUserPosition }) {
  return (
    <CellAmount
      icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
      amount={formatStakeAmount(position.usdsDebt)}
    />
  );
}

/** Claimable-rewards cell: USD value of every reward earned by this urn. */
function PositionClaimableCell({ position }: { position: StakeUserPosition }) {
  const chainId = useChainId();
  const urnAddress = position.urnAddress;
  const { data: rewardContracts } = useStakeRewardContracts();
  const {
    data: toClaim,
    isLoading,
    error
  } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddress ? [urnAddress] : [],
    chainId,
    enabled: Boolean(urnAddress && rewardContracts?.length)
  });
  const { data: prices, isLoading: pricesLoading } = usePrices();

  if (isLoading || pricesLoading || !urnAddress) return <Skeleton className="h-5 w-16" />;
  if (error && !toClaim) {
    // A failed claimables read is "unknown", not $0.00.
    return (
      <span data-testid="stake-position-claimable-unavailable" className="text-textSecondary text-sm">
        –
      </span>
    );
  }

  const claimable = toClaim ?? [];
  const usdValue = claimable.reduce((total, reward) => {
    const price = parseFloat(prices?.[reward.rewardSymbol]?.price ?? '0');
    return total + Number(formatUnits(reward.claimBalance, 18)) * price;
  }, 0);
  const symbols = claimable.length > 0 ? claimable.map(reward => reward.rewardSymbol) : ['SKY'];

  return (
    <CellAmountWithToken amount={formatUsd(usdValue)} icon={<TokenIconStack symbols={symbols} size={12} />} />
  );
}

function PositionIdCell({ position }: { position: StakeUserPosition }) {
  const inactive = isInactiveStakePosition(position);
  return (
    // Inactive positions read through Iconbox/Position's own Inactive variant
    // (Figma 5051:145321) rather than a blanket opacity — the comp keeps the
    // label at full-strength fg-primary and only neutralizes the mark.
    <div data-testid={`stake-position-id-${position.index}`}>
      <CellPosition
        icon={<StakeSky width={16} height={16} />}
        label={<Trans>Position {position.index + 1}</Trans>}
        inactive={inactive}
      />
    </div>
  );
}

const stakedCell = (position: StakeUserPosition) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
    amount={formatStakeAmount(position.skyLocked)}
  />
);

const COLUMNS: ProductTransactionColumn<StakeUserPosition>[] = [
  {
    id: 'position',
    header: <Trans>Position ID</Trans>,
    width: '1.4fr',
    cell: position => <PositionIdCell position={position} />
  },
  {
    id: 'staked',
    header: <Trans>Total staked (SKY)</Trans>,
    width: '1.2fr',
    cell: stakedCell
  },
  {
    id: 'borrowed',
    header: <Trans>Total borrowed (USDS)</Trans>,
    width: '1.2fr',
    cell: position => <PositionBorrowedCell position={position} />
  },
  {
    id: 'risk',
    header: <Trans>Liquidation risk</Trans>,
    width: '1fr',
    cell: position => <PositionRiskCell position={position} />
  },
  {
    id: 'claimable',
    header: <Trans>Claimable rewards</Trans>,
    width: '1.2fr',
    cell: position => <PositionClaimableCell position={position} />
  },
  {
    id: 'chevron',
    header: null,
    width: '64px',
    skeleton: false,
    cell: () => (
      <span className="flex justify-center">
        <CellChevron />
      </span>
    )
  }
];

// Mobile position card (comp 1222:16771 / 1295:21684): 36px position iconbox
// with a Label 4 title, equal-column CardField pairs split by centered
// hairlines, and a full-width secondary "View more" footer. The card wrapper
// still owns the tap-to-manage behavior (the engine wires onRowClick to it);
// the button simply bubbles into that same handler.
const renderCard = (position: StakeUserPosition) => (
  <TransactionCard
    header={
      <span className="flex items-center gap-3" data-testid={`stake-position-id-${position.index}`}>
        {/* Same inactive treatment as the desktop cell: the variant, not opacity. */}
        <IconboxPosition inactive={isInactiveStakePosition(position)}>
          <StakeSky width={16} height={16} />
        </IconboxPosition>
        <span className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          <Trans>Position {position.index + 1}</Trans>
        </span>
      </span>
    }
    footer={
      <>
        <div className="flex w-full flex-col gap-6">
          <CardFieldRow>
            <CardField label={<Trans>Total staked (SKY)</Trans>}>{stakedCell(position)}</CardField>
            <CardFieldDivider />
            <CardField label={<Trans>Total borrowed (USDS)</Trans>}>
              <PositionBorrowedCell position={position} />
            </CardField>
          </CardFieldRow>
          <CardFieldRow>
            <CardField label={<Trans>Liquidation risk</Trans>}>
              <PositionRiskCell position={position} />
            </CardField>
            <CardFieldDivider />
            <CardField label={<Trans>Claimable rewards</Trans>}>
              <PositionClaimableCell position={position} />
            </CardField>
          </CardFieldRow>
        </div>
        <Button variant="secondary" size="m" className="w-full">
          <Trans>View more</Trans>
        </Button>
      </>
    }
  />
);

/**
 * Active-positions table (hi-fi 486:31830 / component 486:32084): one row per
 * staking urn with a "Hide inactive positions" toggle (emptied urns stay
 * on-chain forever, so they stay listed behind it). Row click stages the F5
 * management modal via `flow=manage&urn_index=N` — nothing mounts on those
 * params until F5, same stub contract as the F2 open-position CTA.
 */
export function StakePositionsTable({
  positions,
  isLoading,
  error,
  contextError,
  onRemediate
}: {
  positions?: StakeUserPosition[];
  isLoading: boolean;
  error?: Error | null;
  /**
   * Subgraph failure: rows are live but carry no bark history, so liquidated
   * urns can't be told from emptied ones. Disables the hide-inactive toggle
   * (with a hint); the filter itself stands down per row via `barks: undefined`.
   */
  contextError?: Error | null;
  /** Warning-banner CTA: stage the given remediation action for that position's manage sheet. */
  onRemediate: (position: StakeUserPosition, action: 'stake' | 'repay') => void;
}) {
  const [hideInactive, setHideInactive] = useState(true);
  const [, setSearchParams] = useAppSearchParams();

  const onRowClick = useCallback(
    (position: StakeUserPosition) => {
      setSearchParams(
        params => {
          params.set(QueryParams.Flow, 'manage');
          params.set(QueryParams.UrnIndex, String(position.index));
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const allPositions = positions ?? [];
  // An emptied urn only hides when it is known NOT to be liquidated: a
  // liquidated one stays listed, and so does one whose bark history is
  // unknown (subgraph down — `isLiquidatedStakePosition` is undefined).
  const visiblePositions = hideInactive
    ? allPositions.filter(
        position => !isInactiveStakePosition(position) || isLiquidatedStakePosition(position) !== false
      )
    : allPositions;
  const filterUnavailable = Boolean(contextError);
  const isEmpty = !isLoading && !error && allPositions.length === 0;

  // Comp 1036:208676: the empty state is a self-contained card — the section
  // title moves inside it and there is no table chrome.
  if (isEmpty) {
    return (
      <Card data-testid="stake-positions-empty" className="flex flex-col gap-6 p-8">
        <h3 className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <Trans>Active positions</Trans>
        </h3>
        <EmptyState illustration={<SuppliedEmpty aria-hidden />}>
          <Trans>You don&apos;t have any staking and borrowing position yet.</Trans>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <Trans>Active positions</Trans>
        </h3>
        {/* Label 5 per comp 1036:214062 (Circular Medium 14/16, -0.28px). The comp
            also puts this on fg-primary; the fgSecondary tint is left as-is. */}
        {allPositions.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <label
              className={cn(
                'text-textSecondary font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]',
                filterUnavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              )}
            >
              {/* Comp 1222:16843 shortens the label at the phone tier. */}
              <span className="md:hidden">
                <Trans>Hide inactive</Trans>
              </span>
              <span className="hidden md:inline">
                <Trans>Hide inactive positions</Trans>
              </span>
              <Switch
                checked={hideInactive}
                onCheckedChange={setHideInactive}
                disabled={filterUnavailable}
                data-testid="stake-hide-inactive-toggle"
              />
            </label>
            {/* Without bark history the filter can't tell an emptied urn from a
                liquidated one, so every position is shown and the switch is
                inert — say so rather than leave a toggle that does nothing. */}
            {filterUnavailable && (
              <span
                data-testid="stake-hide-inactive-unavailable"
                className="text-textSecondary font-circle text-xs leading-4"
              >
                <Trans>Liquidation history unavailable — showing all positions</Trans>
              </span>
            )}
          </div>
        )}
      </div>

      <ProductTransactionsTable
        dataTestId="stake-positions-table"
        columns={COLUMNS}
        rows={visiblePositions}
        rowKey={position => String(position.index)}
        rowTestId={position => `stake-position-row-${position.index}`}
        onRowClick={onRowClick}
        isLoading={isLoading}
        error={error}
        emptyLabel={<Trans>No active positions.</Trans>}
        emptyIllustration={<SuppliedEmpty aria-hidden />}
        renderCard={renderCard}
        cardSkeleton={<TransactionCardSkeleton fieldRows={2} fieldRowGapClassName="gap-6" />}
        renderBelowRow={position => (
          <StakePositionRowBanner
            position={position}
            onRemediate={action => onRemediate(position, action)}
            onClaim={() => onRowClick(position)}
          />
        )}
      />
    </div>
  );
}
