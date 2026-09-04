import { Skeleton } from '@/components/ui/skeleton';
import { useStakeUserPositions, StakeUserPosition } from '../hooks/useStakeUserPositions';
import { StakePositionsTable } from './StakePositionsTable';
import { StakeSummaryCard } from './StakeSummaryCard';
import { StakeActivityTable } from './StakeActivityTable';
import { StakeEngineCard } from './StakeEngineCard';

/**
 * My positions tab body (hi-fi 486:31830): the active-positions table with the
 * aggregate summary card in the right rail, and the activity table below. With
 * no positions (or disconnected) the rail falls back to the Sky Staking Engine
 * promo card — the flow entry point of the empty state (UX 929:11803).
 */
export function StakePositionsTab({
  onRemediate
}: {
  /** Passed straight through to the positions table — see its prop doc. */
  onRemediate: (position: StakeUserPosition, action: 'stake' | 'repay') => void;
}) {
  const { data: positions, isLoading, error } = useStakeUserPositions();
  const hasPositions = (positions?.length ?? 0) > 0;

  // Mobile comp 1222:16771 leads with the rail content (summary hero / promo
  // card) before the tables, so the phone tier reorders via `order-*` while
  // the lg grid keeps its DOM placement.
  return (
    <div data-testid="stake-positions-tab" className="grid items-start gap-10 lg:grid-cols-3 lg:gap-6">
      {/* Two panes at lg (ProductDetailTemplate's pattern): the left pane is a
          real column so positions → activity follow its normal flow beside the
          self-heighted rail. Below lg the pane dissolves (`contents`) and
          `order` restores the stacked sequence summary → positions → activity.
          Positions→activity is 80px at lg (Figma Annotations R2 A3, measured)
          — owned by this wrapper's own gap, so it doesn't touch the outer
          grid's gap-10, which also sets the rail's spacing below lg. */}
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-20">
        <div className="order-2">
          <StakePositionsTable
            positions={positions}
            isLoading={isLoading}
            error={error}
            onRemediate={onRemediate}
          />
        </div>
        <div className="order-3">
          <StakeActivityTable positions={positions} />
        </div>
      </div>
      {/* The rail pins at the two-pane tier (Figma 2829:138694 — sticky
          position card); `top-32` mirrors ProductDetailTemplate's offset. */}
      <div className="order-1 lg:sticky lg:top-32 lg:order-none lg:col-span-1">
        {isLoading ? (
          <Skeleton className="rounded-card h-[420px]" />
        ) : hasPositions ? (
          <StakeSummaryCard positions={positions} />
        ) : (
          <StakeEngineCard />
        )}
      </div>
    </div>
  );
}
