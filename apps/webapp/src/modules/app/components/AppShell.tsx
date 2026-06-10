import { Layout } from '@/modules/layout/components/Layout';
import { AppContainer } from './AppContainer';
import { WidgetPane } from './WidgetPane';
import { DetailsPane } from './DetailsPane';
import { useAppOrchestration } from '../hooks/useAppOrchestration';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

/**
 * Component of the pathless shell route: the app chrome shared by every
 * module route. Runs the app-level orchestration and renders the two-pane
 * module content.
 */
export function AppShell() {
  const { intent, detailsParam } = useAppOrchestration();
  const { bpi } = useBreakpointIndex();

  return (
    <Layout>
      <AppContainer>
        <WidgetPane key={`widget-pane-${bpi}`} intent={intent}>
          {bpi === BP.sm && detailsParam && <DetailsPane intent={intent} />}
        </WidgetPane>
        {bpi > BP.sm && detailsParam && <DetailsPane intent={intent} />}
      </AppContainer>
    </Layout>
  );
}
