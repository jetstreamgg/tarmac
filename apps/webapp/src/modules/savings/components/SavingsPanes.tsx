import { Intent } from '@/lib/enums';
import { DualSwitcher } from '@/components/DualSwitcher';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { SavingsWidgetPane } from './SavingsWidgetPane';
import { SavingsDetails } from './SavingsDetails';

export function SavingsPanes() {
  const { bpi } = useBreakpointIndex();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`savings-${bpi}`}
      widget={withErrorBoundary(
        <SavingsWidgetPane rightHeaderComponent={<DualSwitcher className="hidden lg:flex" />} />
      )}
      details={
        <DetailsLayout intent={Intent.SAVINGS_INTENT}>
          <SavingsDetails />
        </DetailsLayout>
      }
    />
  );
}
