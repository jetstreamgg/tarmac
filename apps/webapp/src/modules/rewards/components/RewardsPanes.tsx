import { Intent } from '@/lib/enums';
import { DualSwitcher } from '@/components/DualSwitcher';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { RewardsWidgetPane } from './RewardsWidgetPane';
import { RewardsDetailsPane } from './RewardsDetailsPane';

/** Panes for the Rewards module, including the reward-contract detail route. */
export function RewardsPanes() {
  const { bpi } = useBreakpointIndex();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`rewards-${bpi}`}
      widget={withErrorBoundary(
        <RewardsWidgetPane rightHeaderComponent={<DualSwitcher className="hidden lg:flex" />} />
      )}
      details={
        <DetailsLayout intent={Intent.REWARDS_INTENT}>
          <RewardsDetailsPane />
        </DetailsLayout>
      }
    />
  );
}
