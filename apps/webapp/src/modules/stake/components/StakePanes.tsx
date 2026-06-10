import { Intent } from '@/lib/enums';
import { DualSwitcher } from '@/components/DualSwitcher';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { StakeWidgetPane } from './StakeWidgetPane';
import { StakeDetailsPane } from './StakeDetailsPane';

export function StakePanes() {
  const { bpi } = useBreakpointIndex();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`stake-${bpi}`}
      widget={withErrorBoundary(
        <StakeWidgetPane rightHeaderComponent={<DualSwitcher className="hidden lg:flex" />} />
      )}
      details={
        <DetailsLayout intent={Intent.STAKE_INTENT}>
          <StakeDetailsPane />
        </DetailsLayout>
      }
    />
  );
}
