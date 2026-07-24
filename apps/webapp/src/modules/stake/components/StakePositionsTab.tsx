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

  return (
    <div data-testid="stake-positions-tab" className="grid items-start gap-6 lg:grid-cols-3">
      {/* Two panes at lg (ProductDetailTemplate's pattern): the left pane is a
          real column so positions → activity follow its normal flow beside the
          self-heighted rail. Below lg the pane dissolves (`contents`) and
          `order` restores the stacked sequence positions → summary → activity. */}
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
        <div className="order-1">
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
      <div className="order-2 lg:order-none lg:col-span-1">
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
