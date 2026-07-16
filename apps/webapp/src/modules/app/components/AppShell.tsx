import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useRouteFullWidth } from '@/lib/navigation';
import { useChainId } from 'wagmi';
import { Layout } from '@/modules/layout/components/Layout';
import { AppContainer } from './AppContainer';
import { ShellChromeContext } from '../context/ShellChromeContext';
import { useAppOrchestration } from '../hooks/useAppOrchestration';
import { useWidgetItems } from '../hooks/useWidgetItems';
import { useDeeplinkAnalytics } from '../hooks/useDeeplinkAnalytics';
import { useNetworkChangeToast } from '../hooks/useNetworkChangeToast';
import { BP, useBreakpointIndex } from '@/hooks';
import { BalancesPanes } from '@/modules/balances/components/BalancesPanes';

/**
 * Height of the website header above the container on mobile: the DS Mobile /
 * Topbar bar — 40px chip row + 2×14px padding (shellHeaderClasses py-3.5).
 * Only feeds the boxed module branch below, which no live route reaches today
 * (the legacy module URLs all redirect); the flag-gated sUSDT vault detail is
 * the remaining TwoPane consumer and takes the default (undefined) paneStyle.
 */
const MOBILE_HEADER_HEIGHT = 68;

/**
 * Component of the pathless shell route: the app chrome shared by every
 * module route. Runs the app-level orchestration and renders the route's
 * two-pane content (via Outlet) inside the widget pane column; full-width
 * destination routes (staticData.fullWidth) render straight into the
 * container instead. The empty `contents` div is the portal target for the
 * md+ details pane, so route components can render it as a sibling of the
 * widget pane column.
 */
export function AppShell() {
  const { intent } = useAppOrchestration();
  const isFullWidth = useRouteFullWidth();
  const { bpi } = useBreakpointIndex();
  const chainId = useChainId();
  const [detailsSlot, setDetailsSlot] = useState<HTMLElement | null>(null);
  const { effectiveIntent } = useWidgetItems(intent);
  useDeeplinkAnalytics(effectiveIntent, chainId);
  useNetworkChangeToast(effectiveIntent);

  // Mobile: the widget pane fills the viewport below the header so the
  // details pane scrolls in from below it. md+: the pane column stretches to
  // the container height and sizes itself via flex.
  const paneStyle = bpi < BP.md ? { height: `calc(100dvh - ${MOBILE_HEADER_HEIGHT}px)` } : undefined;

  return (
    <Layout fullWidth={isFullWidth}>
      {/* Destination pages render bare — directly on the page background, no
          container card (V2 Figma), and scroll on the document. Module routes
          keep the card + its inner-scroll box. */}
      <AppContainer variant={isFullWidth ? 'bare' : 'card'}>
        {isFullWidth ? (
          // Destination pages own the whole container; no module content, so
          // the geo fallback below doesn't apply.
          <div className="w-full">
            <Outlet />
          </div>
        ) : (
          <>
            <div
              data-testid="widget-pane-column"
              className="w-full md:flex md:max-w-[440px] md:min-w-[352px] md:flex-col lg:max-w-[416px] lg:min-w-[416px] lg:flex-1 lg:overflow-hidden"
            >
              <ShellChromeContext.Provider value={{ paneStyle, detailsSlot }}>
                {/* Geo-restricted module (or geo-config still loading): fall back to
                    the Balances pair like the legacy switch did, regardless of which
                    module route matched. */}
                {effectiveIntent !== intent ? <BalancesPanes /> : <Outlet />}
              </ShellChromeContext.Provider>
            </div>
            <div className="contents" ref={setDetailsSlot} />
          </>
        )}
      </AppContainer>
    </Layout>
  );
}
