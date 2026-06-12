import { useEffect } from 'react';
import { Intent } from '@/lib/enums';
import { IntentMapping } from '@/lib/constants';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';

// Module-level guard: persists across React remounts/StrictMode, resets on page reload (fresh deeplink)
let lastDeeplinkTracked: string | null = null;

/**
 * Deeplink detection: fire app_widget_selected when the initial intent ≠ default (balances).
 * Uses a module-level guard (not useRef) so it survives React StrictMode remounts and
 * key-driven remounts.
 */
export function useDeeplinkAnalytics(effectiveIntent: Intent, chainId: number) {
  const { trackWidgetSelected } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  useEffect(() => {
    if (
      effectiveIntent &&
      effectiveIntent !== Intent.BALANCES_INTENT &&
      effectiveIntent !== lastDeeplinkTracked
    ) {
      lastDeeplinkTracked = effectiveIntent;
      startNewFlow();
      trackWidgetSelected({
        widgetName: IntentMapping[effectiveIntent] || effectiveIntent,
        previousWidget: IntentMapping[Intent.BALANCES_INTENT],
        selectionMethod: 'deeplink',
        chainId
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
