import { useStakeUserPositions, StakeUserPosition } from '../hooks/useStakeUserPositions';
import { StakePositionsTable } from './StakePositionsTable';
import { StakeActivityTable } from './StakeActivityTable';
import { StakeRewardsSection } from './StakeRewardsSection';
import { StakeRailCard, type StakeRailCardProps } from './StakeRailCard';

/**
 * My positions tab body (hi-fi 486:31830): the active-positions table with the
 * shared rail card (`StakeRailCard`: summary card / promo card / skeleton) in
 * the right rail, and the activity table below.
 */
export function StakePositionsTab({
  onRemediate,
  rail
}: {
  /** Passed straight through to the positions table — see its prop doc. */
  onRemediate: (position: StakeUserPosition, action: 'stake' | 'repay') => void;
  /** The page's positions read, for the shared rail card. */
  rail: StakeRailCardProps;
}) {
  const { data: positions, isLoading, error, contextError } = useStakeUserPositions();

  // Mobile comp 1222:16771 leads with the rail content (summary hero / promo
  // card) before the tables, so the phone tier reorders via `order-*` while
  // the desktop grid keeps its DOM placement. Two panes only from desktop:
  // the tables and hero figure can't fit a 912-1199 split (APP-606).
  return (
    <div
      data-testid="stake-positions-tab"
      className="desktop:grid-cols-3 desktop:gap-8 grid grid-cols-1 items-start gap-10"
    >
      {/* Two panes at desktop (ProductDetailTemplate's pattern): the left pane is a
          real column so positions → activity follow its normal flow beside the
          self-heighted rail. Below desktop the pane dissolves (`contents`) and
          `order` restores the stacked sequence summary → positions → activity.
          Positions→activity is 80px at desktop (Figma Annotations R2 A3, measured)
          — owned by this wrapper's own gap, so it doesn't touch the outer
          grid's gap-10, which also sets the rail's spacing below desktop. */}
      <div className="desktop:col-span-2 desktop:flex desktop:flex-col desktop:gap-20 contents">
        <div className="order-2">
          <StakePositionsTable
            positions={positions}
            isLoading={isLoading}
            error={error}
            contextError={contextError}
            onRemediate={onRemediate}
          />
        </div>
        {/* Renders nothing (and takes no gap) when nothing is claimable. */}
        <StakeRewardsSection positions={positions} />
        <div className="order-3">
          <StakeActivityTable positions={positions} />
        </div>
      </div>
      {/* The rail pins at the two-pane tier (Figma 2829:138694 — sticky
          position card), same offset as stickyRailClasses. */}
      <div className="desktop:sticky desktop:top-22 desktop:self-start desktop:order-none desktop:col-span-1 order-1">
        <StakeRailCard {...rail} />
      </div>
    </div>
  );
}
