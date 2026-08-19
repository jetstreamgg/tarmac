import { useEffect, useRef } from 'react';
import { useChainId } from 'wagmi';
import { router } from '@/pages/router';
import { useAppAnalytics } from './useAppAnalytics';
import { useAnalyticsFlow } from '../context/AnalyticsFlowContext';
import { createNavigationSubscriber } from '../lib/navigationAnalytics';

/**
 * Central navigation analytics (APP-444 fase 2): one router.history
 * subscription emits app_widget_selected + rotates the flow_id for in-app
 * navigations (same pattern as GeoConfigProvider). Mounted once in AppContent;
 * the initial location is skipped — useDeeplinkAnalytics owns the landing.
 */
export function useNavigationAnalytics(): void {
  const { trackWidgetSelected } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();
  const chainId = useChainId();

  // Latest-ref so the long-lived subscriber reads current chain/track deps.
  const latest = useRef({ trackWidgetSelected, startNewFlow, chainId });
  useEffect(() => {
    latest.current = { trackWidgetSelected, startNewFlow, chainId };
  });

  useEffect(() => {
    const subscriber = createNavigationSubscriber(router.history.location.pathname, {
      startNewFlow: () => latest.current.startNewFlow(),
      trackWidgetSelected: args => latest.current.trackWidgetSelected(args),
      getChainId: () => latest.current.chainId
    });
    return router.history.subscribe(subscriber);
  }, []);
}
