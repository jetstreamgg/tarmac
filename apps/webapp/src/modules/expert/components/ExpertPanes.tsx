import { ExpertIntent, Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useRouteExpertIntent } from '@/lib/navigation';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExpertWidgetPane } from './ExpertWidgetPane';
import { ExpertDetailsPane } from './ExpertDetailsPane';
import { StUSDSDetails } from '@/modules/stusds/components/StUSDSDetails';

/** Panes for the Expert module, including the stUSDS submodule route. */
export function ExpertPanes() {
  const { bpi } = useBreakpointIndex();
  const routeExpertIntent = useRouteExpertIntent();
  const { expertRiskDisclaimerShown } = useConfigContext();

  // Submodule details only render once the risk disclaimer has been
  // acknowledged; until then (the orchestration redirect is in flight) the
  // overview details show, matching the legacy selection sync.
  const expertOption = expertRiskDisclaimerShown ? routeExpertIntent : undefined;
  const isStusds = expertOption === ExpertIntent.STUSDS_INTENT;

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`expert-${bpi}`}
      widget={withErrorBoundary(<ExpertWidgetPane />)}
      details={
        <DetailsLayout intent={Intent.EXPERT_INTENT} contentKey={isStusds ? 'stusds' : 'overview'}>
          {isStusds ? <StUSDSDetails /> : <ExpertDetailsPane />}
        </DetailsLayout>
      }
    />
  );
}
