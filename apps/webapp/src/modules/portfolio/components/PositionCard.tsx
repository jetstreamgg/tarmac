import { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import {
  formatDecimalPercentage,
  formatUsd,
  getChainIcon,
  getChainName,
  projectAnnualEarnings
} from '@/utils';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconboxStatus } from '@/components/ui/iconbox';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { productStatusType } from '@/components/product/productVisuals';
import type { SuppliedPosition } from '../helpers/suppliedView';
import type { PositionEarnings } from '../earnings/earningsForPosition';
import { ProductGlyph } from './ProductGlyph';
import { EarningsFigureValue, StatInfoGlyph } from './EarningsStat';

// DS type tokens, resolved per the comps (mobile 486:20195 → desktop 486:20044).
// Every one is responsive, so the card is NOT tier-agnostic. Color comes from the
// consumer: values are fg-primary, labels/network name are fg-secondary.

// Label 5 stat value: 12/14 → 14/16, Circular medium.
const statValue =
  'font-circle text-xs leading-[14px] font-medium tracking-[-0.24px] md:text-sm md:leading-4 md:tracking-[-0.28px]';
// Body 6 stat label: 11/16 → 12/18, Graphik regular.
const statLabel =
  'font-graphik text-fgSecondary text-[11px] leading-4 font-normal md:text-xs md:leading-[18px]';
// Label 6 network name: 11/12 → 12/14, Circular medium, fg-primary.
const networkName =
  'font-circle text-fgPrimary text-[11px] leading-3 font-medium tracking-[-0.22px] md:text-xs md:leading-[14px] md:tracking-[-0.24px]';
// DS Badges/Illustration pill: glass badge fill (Components/Badges/bg-secondary),
// 20px radius, 4px/8px/4px/4px padding, 4px gap — per the comp.
const badgePill = 'bg-glassBadge flex items-center gap-1 rounded-[20px] py-1 pr-2 pl-1';

/**
 * One supplied position in the Portfolio carousel: a 64px ringed status iconbox,
 * the network badge, a 2×2 stats block split by per-row dividers, and
 * Supply/Manage actions. Presentational — the caller owns each action
 * (`onSupply` opens the product's supply modal in place, switching networks
 * first when needed; products without a modal route to the product page).
 */
export function PositionCard({
  position,
  alreadyEarned,
  onSupply,
  onManage
}: {
  position: SuppliedPosition;
  /** APP-450 earnings slice for this row; null → outside scope, renders a dash. */
  alreadyEarned: PositionEarnings | null;
  onSupply: () => void;
  onManage: () => void;
}) {
  const projected = projectAnnualEarnings(position.amountUsd, position.rate);

  return (
    // Phone keeps the mobile comp's 20px inset / 28px block rhythm
    // (486:20195); from md the desktop comp (1030:58714, APP-443 item 8) takes
    // over with a 32/28 inset and 40px between blocks.
    <Card className="flex flex-col gap-7 p-5 md:gap-10 md:px-8 md:py-7" data-testid="position-card">
      {/* DS Iconbox/Status: 64px box, borderTertiary ring, 52px token inside. */}
      <div className="flex items-start justify-between">
        <IconboxStatus size="l" type={productStatusType(position)} dot={!!productStatusType(position)}>
          <TokenIcon token={{ symbol: position.tokenSymbol }} width={52} showChainIcon={false} />
        </IconboxStatus>
        <NetworkBadge chainIds={position.chainIds} />
      </div>

      <div className="flex items-center gap-1.5">
        {/* DS Heading 5 (Circular medium), responsive: 20/22 mobile → 24/26 desktop. */}
        <span className="text-fgPrimary font-circle text-xl leading-[22px] font-medium tracking-[-0.4px] md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
          {position.name}
        </span>
        <ProductGlyph id={position.id} kind={position.kind} />
      </div>

      {/* Two stat rows, each pair split by its own short vertical divider; the
          first column is fixed so the divider aligns across both rows. */}
      <div className="flex flex-col gap-5">
        <div className="flex">
          <Stat
            className="w-[112px]"
            label={<Trans>My position</Trans>}
            value={<span className={cn(statValue, 'text-fgPrimary')}>{formatUsd(position.amountUsd)}</span>}
          />
          <StatDivider />
          <Stat
            className="flex-1"
            label={<Trans>Rate</Trans>}
            value={
              position.rateLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <span className={cn(statValue, 'text-fgPrimary')}>
                  {formatDecimalPercentage(position.rate ?? 0)}
                </span>
              )
            }
          />
        </div>
        <div className="flex">
          <Stat
            className="w-[112px]"
            label={<Trans>Accrued to date</Trans>}
            value={
              <EarningsFigureValue
                figure={alreadyEarned?.totalEarned ?? null}
                missing={alreadyEarned?.missingFromTotal}
                coverage={alreadyEarned?.coverage}
                variant="plain"
                className={cn(
                  statValue,
                  alreadyEarned?.totalEarned?.status === 'ok' ? 'text-fgPrimary' : 'text-fgSecondary'
                )}
                testId="position-already-earned"
                pendleSplit={alreadyEarned?.pendleSplit}
                skeletonClassName="h-3.5 w-14 rounded"
              />
            }
          />
          <StatDivider />
          <Stat
            className="flex-1"
            label={<Trans>Projected 1Y yield</Trans>}
            value={
              position.rateLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <span className={cn(statValue, 'text-fgPrimary flex items-center gap-1')}>
                  {/* 12px at every tier — both comps draw it that size. */}
                  <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
                  {formatUsd(projected)}
                  <StatInfoGlyph testId="projected-yield-info">
                    <Trans>Using your current rate as a reference</Trans>
                  </StatInfoGlyph>
                </span>
              )
            }
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="l"
          className="flex-1"
          onClick={onSupply}
          data-testid="position-card-supply"
        >
          <Trans>Supply</Trans>
        </Button>
        <Button
          variant="secondary"
          size="l"
          className="flex-1"
          onClick={onManage}
          data-testid="position-card-manage"
        >
          <Trans>Manage</Trans>
        </Button>
      </div>
    </Card>
  );
}

/**
 * DS Badges/Illustration: a 16px chain icon + chain name for a single-chain
 * position. Positions holding balances on several chains keep the stacked icons
 * with an "N networks" label (the comp only specifies the single-chain case).
 */
function NetworkBadge({ chainIds }: { chainIds: number[] }) {
  if (chainIds.length === 1) {
    return (
      <span className={badgePill} data-testid="position-card-networks">
        <span className="flex h-4 w-4 shrink-0">{getChainIcon(chainIds[0], 'h-full w-full')}</span>
        <span className={networkName}>{getChainName(chainIds[0])}</span>
      </span>
    );
  }
  return (
    <span className={cn(badgePill, 'gap-1.5')} data-testid="position-card-networks">
      <IconStack size={16}>{chainIds.map(id => getChainIcon(id, 'h-full w-full'))}</IconStack>
      {/* Always ≥2 chains here (the single-chain case returns above), so the
          label is always plural — no ICU pluralization needed. */}
      <span className={networkName}>
        <Trans>{chainIds.length} networks</Trans>
      </span>
    </span>
  );
}

function Stat({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className={statLabel}>{label}</span>
      {value}
    </div>
  );
}

/** Short vertical divider between the two stats in a row: 29.5px, centred in
 *  the 38px row rather than stretched to it (both comps). */
function StatDivider() {
  return <div className="bg-border mx-5 h-[29.5px] w-px shrink-0 self-center" />;
}
