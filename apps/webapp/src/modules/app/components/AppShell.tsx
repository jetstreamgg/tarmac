import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useChainId } from 'wagmi';
import { Layout } from '@/modules/layout/components/Layout';
import { AppContainer } from './AppContainer';
import { WidgetNavigation } from './WidgetNavigation';
import { useAppOrchestration } from '../hooks/useAppOrchestration';
import { useWidgetItems } from '../hooks/useWidgetItems';
import { useDeeplinkAnalytics } from '../hooks/useDeeplinkAnalytics';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { LegacyPanes } from './LegacyPanes';

/**
 * Component of the pathless shell route: the app chrome shared by every
 * module route. Runs the app-level orchestration and renders the navigation
 * around the route's two-pane content (via Outlet). The empty `contents` div
 * is the portal target for the md+ details pane, so route components can
 * render it as a sibling of the navigation column.
 */
export function AppShell() {
  const { intent } = useAppOrchestration();
  const { bpi } = useBreakpointIndex();
  const chainId = useChainId();
  const [detailsSlot, setDetailsSlot] = useState<HTMLElement | null>(null);
  const { widgetContent, effectiveIntent } = useWidgetItems(intent);
  useDeeplinkAnalytics(effectiveIntent, chainId);

  return (
    <Layout>
      <AppContainer>
        <WidgetNavigation
          key={`widget-nav-${bpi}`}
          widgetContent={widgetContent}
          intent={effectiveIntent}
          currentChainId={chainId}
          detailsSlot={detailsSlot}
        >
          {/* Geo-restricted module (or geo-config still loading): fall back to
              the Balances pair like the legacy switch did, regardless of which
              module route matched. */}
          {effectiveIntent !== intent ? <LegacyPanes /> : <Outlet />}
        </WidgetNavigation>
        <div className="contents" ref={setDetailsSlot} />
      </AppContainer>
    </Layout>
  );
}
