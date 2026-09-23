import { Trans } from '@lingui/react/macro';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ProductActions,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { StakeSummaryCard } from './StakeSummaryCard';
import { StakeEngineCard } from './StakeEngineCard';

export type StakeRailCardProps = {
  /** The connected user's stake positions, from the page's one query. */
  positions?: StakeUserPosition[];
  isLoading: boolean;
};

/**
 * Loading stand-in shaped like the summary card it precedes: the same card
 * shell, hero inset, stat rows and CTA height, so the rail keeps its height
 * (and the table beside it its place) when the positions land. The stat
 * labels are static, so they render for real over the same value skeletons
 * the loaded card uses per stat.
 */
function StakeRailCardSkeleton() {
  return (
    <ProductPositionCard
      data-testid="stake-rail-card-loading"
      className="rounded-[20px] md:rounded-[28px]"
      hero={
        <div className="flex flex-col gap-10 rounded-2xl p-4 md:gap-16 md:p-6">
          <Skeleton className="h-6 w-28 rounded-full" />
          <div className="flex flex-col gap-2">
            <div className="flex h-[35px] items-center gap-2 md:h-12">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-7 w-48 md:h-9 md:w-64" />
            </div>
            <div className="pl-10">
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      }
      stats={
        <>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Claimable rewards</Trans>}>
              <Skeleton className="h-5 w-20" />
            </ProductStat>
            <ProductStat label={<Trans>Total rewards received</Trans>}>
              <Skeleton className="h-5 w-20" />
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Total borrowed</Trans>}>
              <Skeleton className="h-5 w-20" />
            </ProductStat>
            <ProductStat label={<Trans>Net APY</Trans>}>
              <Skeleton className="h-5 w-20" />
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        <ProductActions>
          <Skeleton className="h-12 w-full rounded-full" />
        </ProductActions>
      }
    />
  );
}

/**
 * The stake product page's right-rail card, shared by all three tabs so they
 * show the same rail state: a skeleton while the user's positions load, the
 * "My position" aggregate summary card (hi-fi 486:31830) when the connected
 * user has stake positions, and otherwise the Sky Staking Engine promo card —
 * the flow entry point of the empty state (UX 929:11803). Fed by the page's
 * own `useStakeUserPositions` read rather than a read of its own: the tabs
 * unmount when inactive, and with the default `staleTime` of 0 every remount
 * would refetch the positions (multicalls + the indexer) on each tab switch.
 */
export function StakeRailCard({ positions, isLoading }: StakeRailCardProps) {
  if (isLoading) return <StakeRailCardSkeleton />;
  if ((positions?.length ?? 0) > 0) return <StakeSummaryCard positions={positions} />;
  return <StakeEngineCard />;
}
