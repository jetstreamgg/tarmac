import { Outlet } from '@tanstack/react-router';
import { useChainId } from 'wagmi';
import { Layout } from '@/modules/layout/components/Layout';
import { AppContainer } from './AppContainer';
import { useAppOrchestration } from '../hooks/useAppOrchestration';
import { useWidgetItems } from '../hooks/useWidgetItems';
import { useDeeplinkAnalytics } from '../hooks/useDeeplinkAnalytics';
import { useNetworkChangeToast } from '../hooks/useNetworkChangeToast';

/**
 * Component of the pathless shell route: the app chrome shared by every
 * module route. Runs the app-level orchestration and renders the matched
 * route's page (via Outlet) inside the container.
 *
 * Every route is a full-width page that scrolls on the document (G5). The
 * legacy two-pane composition — a widget-pane column beside a portaled
 * details pane, both scrolling inside a viewport-capped box — is gone, along
 * with the `staticData.fullWidth` switch that used to select between them.
 */
export function AppShell() {
  const { intent } = useAppOrchestration();
  const chainId = useChainId();
  const { effectiveIntent } = useWidgetItems(intent);
  useDeeplinkAnalytics(effectiveIntent, chainId);
  useNetworkChangeToast(effectiveIntent);

  return (
    <Layout>
      {/* Pages render bare — directly on the page background, no container
          card (V2 Figma) — and scroll on the document. */}
      <AppContainer>
        {/* `page-transition` names this box as the only view-transition group
            (globals.css), so a route change animates just the page content —
            everything else keeps painting live and stays still. */}
        <div className="page-transition w-full">
          <Outlet />
        </div>
      </AppContainer>
    </Layout>
  );
}
