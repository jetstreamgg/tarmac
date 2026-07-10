import { useCallback, useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import {
  useStakeUrnAddress,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  useVault,
  usePrices,
  getIlkName,
  RiskLevel,
  ZERO_ADDRESS
} from '@/hooks';
import { formatUsd } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { cn } from '@/lib/cn';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { Stake, Liquidated } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskMeter } from '@/components/product/RiskMeter';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { CellAmount, CellAmountWithToken, CellChevron, CellPosition } from '@/components/ui/table-cells';
import {
  StakeUserPosition,
  isInactiveStakePosition,
  isLiquidatedStakePosition
} from '../hooks/useStakeUserPositions';
import { StakePositionRowBanner } from './StakePositionRowBanner';

// Liquidation-proximity mapping for the shared risk pill: more (and warmer)
// lit segments = closer to liquidation; rows with no debt render unlit
// (Figma Type=Risk "None"). Colors are the design-system status palette the
// pill uses everywhere; a 3-lit error tier never appears in the Figma
// patterns — red pending design confirmation. The pill chrome is the shared
// RiskMeter (review feedback: one pill app-wide).
const RISK_SEGMENTS: Record<RiskLevel, { lit: number; color: string }> = {
  [RiskLevel.LOW]: { lit: 1, color: 'bg-statusSuccess' },
  [RiskLevel.MEDIUM]: { lit: 2, color: 'bg-statusWarning' },
  [RiskLevel.HIGH]: { lit: 3, color: 'bg-error' },
  [RiskLevel.LIQUIDATION]: { lit: 3, color: 'bg-error' }
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
      className="bg-error/15 text-error inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <Liquidated width={16} height={16} />
      <Trans>Liquidation</Trans>
    </span>
  );
}

/** Liquidation-risk cell: liquidated badge, vault risk for urns with debt, or an unlit meter. */
function PositionRiskCell({ position }: { position: StakeUserPosition }) {
  const { data: urnAddress } = useStakeUrnAddress(BigInt(position.index));
  const { data: vault, isLoading, error } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(2));
  const hasDebt = position.usdsDebt > 0n;

  if (isLiquidatedStakePosition(position)) return <LiquidatedBadge />;
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
  return <PositionRiskMeter riskLevel={hasDebt ? vault?.riskLevel : undefined} />;
}

/**
 * Borrowed cell: LIVE debt (principal + accrued interest) from the Vat — the
 * figure the legacy widget shows (`vault.debtValue`). The subgraph's principal
 * stands in only until the on-chain read lands. Shares the risk cell's cached
 * vault read, so this adds no extra RPC.
 */
function PositionBorrowedCell({ position }: { position: StakeUserPosition }) {
  const { data: urnAddress } = useStakeUrnAddress(BigInt(position.index));
  const { data: vault } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(2));

  return (
    <CellAmount
      icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
      amount={formatStakeAmount(vault?.debtValue ?? position.usdsDebt)}
    />
  );
}

/** Claimable-rewards cell: USD value of every reward earned by this urn. */
function PositionClaimableCell({ position }: { position: StakeUserPosition }) {
  const chainId = useChainId();
  const { data: urnAddress } = useStakeUrnAddress(BigInt(position.index));
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
  const { data: prices } = usePrices();

  if (isLoading || !urnAddress) return <Skeleton className="h-5 w-16" />;
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
    <div data-testid={`stake-position-id-${position.index}`} className={cn(inactive && 'opacity-50')}>
      <CellPosition
        icon={<Stake width={16} height={16} />}
        label={<Trans>Position {position.index + 1}</Trans>}
      />
    </div>
  );
}

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
    cell: position => (
      <CellAmount
        icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
        amount={formatStakeAmount(position.skyLocked)}
      />
    )
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
    cell: () => (
      <span className="flex justify-center">
        <CellChevron />
      </span>
    )
  }
];

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
  onRemediate
}: {
  positions?: StakeUserPosition[];
  isLoading: boolean;
  error?: Error | null;
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
  const visiblePositions = hideInactive
    ? allPositions.filter(
        position => !isInactiveStakePosition(position) || isLiquidatedStakePosition(position)
      )
    : allPositions;
  const isEmpty = !isLoading && !error && allPositions.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text text-lg font-medium">
          <Trans>Active positions</Trans>
        </h3>
        {allPositions.length > 0 && (
          <label className="text-textSecondary flex cursor-pointer items-center gap-2 text-sm">
            <Trans>Hide inactive positions</Trans>
            <Switch
              checked={hideInactive}
              onCheckedChange={setHideInactive}
              data-testid="stake-hide-inactive-toggle"
            />
          </label>
        )}
      </div>

      {isEmpty ? (
        <Card
          data-testid="stake-positions-empty"
          className="flex flex-col items-center justify-center gap-4 px-6 py-16"
        >
          <span className="flex items-center" aria-hidden>
            <span className="bg-textSecondary/20 h-10 w-10 rounded-full" />
            <span className="bg-textSecondary/30 -ml-4 h-10 w-10 rounded-full" />
          </span>
          <p className="text-textSecondary text-center text-sm">
            <Trans>You don&apos;t have any staking and borrowing position yet.</Trans>
          </p>
        </Card>
      ) : (
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
          minWidth={720}
          renderBelowRow={position => (
            <StakePositionRowBanner
              position={position}
              onRemediate={action => onRemediate(position, action)}
              onClaim={() => onRowClick(position)}
            />
          )}
        />
      )}
    </div>
  );
}
