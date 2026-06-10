import { Intent } from '@/lib/enums';
import { DualSwitcher } from '@/components/DualSwitcher';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { PendleWidgetPane } from './PendleWidgetPane';
import { PendleDetailsPane } from './PendleDetailsPane';

/** Panes for the Fixed Yield module, including the market detail route. */
export function PendlePanes() {
  const { bpi } = useBreakpointIndex();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`fixed-${bpi}`}
      widget={withErrorBoundary(
        <PendleWidgetPane rightHeaderComponent={<DualSwitcher className="hidden lg:flex" />} />
      )}
      details={
        <DetailsLayout intent={Intent.FIXED_INTENT}>
          <PendleDetailsPane />
        </DetailsLayout>
      }
    />
  );
}
