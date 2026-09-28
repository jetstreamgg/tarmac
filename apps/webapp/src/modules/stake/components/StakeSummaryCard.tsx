import { ReactNode, useCallback, useMemo } from 'react';
import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import {
  useSkyPrice,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  usePrices,
  useStakeHistory
} from '@/hooks';
import { formatUsd } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { calculateClaimedRewardsUsd } from '../lib/positionDetail';
import { priceOfFromPrices, sumRewardsUsd, wadToUsd } from '../lib/stakeUsdNotional';
import { QueryParams, NO_VALUE } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import {
  ProductActions,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useStakeEstAnnualRewardsUsd } from '../hooks/useStakeEstAnnualRewardsUsd';
import { useStakeRowVault } from '../hooks/useStakeRowVault';
import { RiskScaleMeter } from '@/components/product/RiskMeter';
import { RiskPill } from './StakeManageBorrowCard';

function SummaryStat({
  label,
  icon,
  iconFirst = false,
  isLoading,
  dataTestId,
  children
}: {
  label: ReactNode;
  icon?: ReactNode;
  /** Hi-fi places the token icon before some values (Total borrowed) and after others. */
  iconFirst?: boolean;
  isLoading?: boolean;
  dataTestId?: string;
  children: ReactNode;
}) {
  return (
    <ProductStat label={label}>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span data-testid={dataTestId} className="flex items-center gap-1">
          {iconFirst && icon}
          {children}
          {!iconFirst && icon}
        </span>
      )}
    </ProductStat>
  );
}

/** Single borrowing position (comp 3617:24520): risk pill over the unlabelled Progress Steps bar. */
function SummaryLiquidationRisk({ position }: { position: StakeUserPosition }) {
  const { data: vault, isLoading } = useStakeRowVault(position);
  return (
    <div data-testid="stake-summary-liquidation-risk" className="flex flex-col gap-4 pb-2">
      <div className="flex flex-col gap-1">
        <span className="text-textSecondary text-xs leading-[18px]">
          <Trans>Liquidation risk</Trans>
        </span>
        {isLoading ? (
          <Skeleton className="h-[18px] w-10" />
        ) : vault?.riskLevel ? (
          <RiskPill riskLevel={vault.riskLevel} dataTestId="stake-summary-risk-pill" />
        ) : (
          <span className="text-fgTertiary text-sm leading-4">{NO_VALUE}</span>
        )}
      </div>
      <RiskScaleMeter
        value={(vault?.liquidationProximityPercentage ?? 0) / 100}
        level={vault?.riskLevel}
        showLabels={false}
      />
    </div>
  );
}

/**
 * Aggregate "My position" summary card (comp 3617:24094): total staked hero,
 * claimable/earned/est. annual/borrowed stats, and a Manage CTA — the manage
 * modal for a single urn, the My positions tab otherwise.
 */
export function StakeSummaryCard({ positions }: { positions?: StakeUserPosition[] }) {
  const chainId = useChainId();
  const [, setSearchParams] = useAppSearchParams();

  const singlePosition = positions?.length === 1 ? positions[0] : undefined;
  const onManage = useCallback(() => {
    setSearchParams(
      params => {
        if (singlePosition) {
          params.set(QueryParams.Flow, 'manage');
          params.set(QueryParams.UrnIndex, String(singlePosition.index));
        } else {
          params.set(QueryParams.Tab, 'positions');
        }
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams, singlePosition]);

  // Both live Vat figures via `useStakeUrnVaults` (debt = art × rate, accrued
  // interest included — legacy parity).
  const totalStaked = (positions ?? []).reduce((total, position) => total + position.skyLocked, 0n);
  const totalBorrowed = (positions ?? []).reduce((total, position) => total + position.usdsDebt, 0n);

  // USD figures: SKY via the protocol price feed; USDS at parity (the same
  // convention the Savings transactions table uses).
  const { priceString: skyPriceString, isLoading: skyPriceLoading } = useSkyPrice();
  const skyPrice = skyPriceString ? parseFloat(skyPriceString) : null;
  const totalStakedUsd = skyPrice !== null ? wadToUsd(totalStaked, skyPrice) : null;

  // Claimable rewards across every urn, valued via the price feed.
  const urnAddresses = useMemo(() => (positions ?? []).map(position => position.urnAddress), [positions]);
  const { data: rewardContracts } = useStakeRewardContracts();
  const {
    data: toClaim,
    isLoading: claimableLoading,
    error: claimableError
  } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddresses,
    chainId,
    enabled: Boolean(urnAddresses.length && rewardContracts?.length)
  });
  // A failed claimables read is "unknown", not $0.00 — dash both reward stats.
  const claimableUnavailable = Boolean(claimableError && !toClaim);
  const { data: prices, isLoading: pricesLoading } = usePrices();
  const priceOf = useMemo(() => priceOfFromPrices(prices), [prices]);
  const claimableUsd = sumRewardsUsd(toClaim ?? [], priceOf);

  // Reward stats carry the icons of what is actually claimable (SKY fallback),
  // e.g. an SPK-earning urn shows the SPK icon — mirrors the table cell.
  const rewardSymbolsHeld =
    toClaim && toClaim.length > 0 ? [...new Set(toClaim.map(reward => reward.rewardSymbol))] : ['SKY'];
  // 12px, matching the USDS mark on the borrow stats beside them and the comp
  // (1030:59227, APP-443 item 15) — they were 16.
  const rewardIcons = <TokenIconStack symbols={rewardSymbolsHeld} size={12} />;

  // Total rewards earned = already-claimed reward events (subgraph) + still
  // claimable. Claimed amounts are valued through the known reward-contract →
  // token map; unknown contracts are skipped rather than mispriced.
  const { data: stakeHistory, isLoading: historyLoading } = useStakeHistory();
  const claimedUsd = useMemo(
    () => calculateClaimedRewardsUsd(stakeHistory, chainId, priceOf),
    [stakeHistory, chainId, priceOf]
  );
  const rewardsEarnedUsd = claimedUsd + claimableUsd;

  const { data: estAnnualUsd, isLoading: estAnnualLoading } = useStakeEstAnnualRewardsUsd(positions);

  const hasDebt = totalBorrowed > 0n;
  const claimableStat = (
    <SummaryStat
      label={<Trans>Claimable rewards</Trans>}
      isLoading={claimableLoading || pricesLoading}
      icon={rewardIcons}
    >
      {claimableUnavailable ? NO_VALUE : formatUsd(claimableUsd)}
    </SummaryStat>
  );
  const earnedStat = (
    <SummaryStat
      label={<Trans>Total rewards earned</Trans>}
      isLoading={claimableLoading || historyLoading || pricesLoading}
      icon={rewardIcons}
    >
      {claimableUnavailable ? NO_VALUE : formatUsd(rewardsEarnedUsd)}
    </SummaryStat>
  );
  const estEarningsStat = (
    <SummaryStat
      label={<Trans>Est. earnings (1Y)</Trans>}
      isLoading={estAnnualLoading}
      icon={rewardIcons}
      dataTestId="stake-summary-est-earnings"
    >
      {estAnnualUsd !== null ? formatUsd(estAnnualUsd) : NO_VALUE}
    </SummaryStat>
  );
  const borrowedStat = (
    <SummaryStat
      label={<Trans>Total borrowed</Trans>}
      isLoading={positions === undefined}
      icon={
        <TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3 shrink-0" showChainIcon={false} />
      }
      iconFirst
      dataTestId="stake-summary-borrowed"
    >
      <span className={!hasDebt ? 'text-fgSecondary' : undefined}>{formatStakeAmount(totalBorrowed)}</span>
    </SummaryStat>
  );

  // The desktop comp (1036:214138) adopts the structure the phone tier
  // (1222:16799) already had — the badge + hero figure in a 6px-inset "Cover"
  // with a bottom brand wash — so the card is now the shared position skeleton
  // at every tier, with the SKY total (no fraction split) over a USD subline.
  return (
    <ProductPositionCard
      data-testid="stake-summary-card"
      className="rounded-[20px] md:rounded-[28px]"
      hero={
        <PositionHero
          pillIcon={<StakeSky className="h-3 w-3" />}
          pillLabel={<Trans>Total Staked</Trans>}
          balanceSymbol="SKY"
          amount={formatStakeAmount(totalStaked)}
          subline={
            skyPriceLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : totalStakedUsd !== null ? (
              `~${formatUsd(totalStakedUsd)}`
            ) : (
              NO_VALUE
            )
          }
        />
      }
      stats={
        // With debt, Total borrowed leads (comp 3617:24493); otherwise it
        // trails as the greyed zero (comp 3617:24094).
        hasDebt ? (
          <>
            <ProductStatPair grow>
              {borrowedStat}
              {claimableStat}
            </ProductStatPair>
            <ProductStatPair grow>
              {estEarningsStat}
              {earnedStat}
            </ProductStatPair>
          </>
        ) : (
          <>
            <ProductStatPair grow>
              {claimableStat}
              {earnedStat}
            </ProductStatPair>
            <ProductStatPair grow>
              {estEarningsStat}
              {borrowedStat}
            </ProductStatPair>
          </>
        )
      }
      actions={
        <div className="flex flex-col gap-8">
          {singlePosition && hasDebt && <SummaryLiquidationRisk position={singlePosition} />}
          <ProductActions>
            <Button variant="secondary" size="xl" onClick={onManage} data-testid="stake-summary-manage-cta">
              <Trans>Manage</Trans>
            </Button>
          </ProductActions>
        </div>
      }
    />
  );
}
