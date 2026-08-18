import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useChainId } from 'wagmi';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import type { UpgradeSourceToken } from '@/hooks';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { pathnameToPreviousWidget } from '@/modules/analytics/lib/navigationAnalytics';
import { useUpgradeModal } from './useUpgradeModal';

const UPGRADE_PARAM_TOKENS: Record<string, UpgradeSourceToken> = {
  dai: 'DAI',
  mkr: 'MKR'
};

/**
 * Consumes the `?upgrade=dai|mkr` deep link: opens the Upgrade DAI/MKR modal
 * with the source token preselected, then strips the param so the modal state
 * never lingers in the URL (the modal has no destination of its own — the
 * param is the shareable-link seam fenris85 asked for on APP-413). The param
 * is consumed whenever it appears, so in-app navigations that set it also
 * launch the modal; unknown values are dropped without opening.
 *
 * The consumed guard covers the gap between opening and the param strip
 * flushing: StrictMode re-runs the effect against the still-set param.
 */
export function useUpgradeDeepLink() {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const { open } = useUpgradeModal();
  const { trackWidgetSelected } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();
  const chainId = useChainId();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    const value = searchParams.get(QueryParams.Upgrade);
    if (value === null) {
      consumedRef.current = null;
      return;
    }
    if (consumedRef.current === value) return;
    consumedRef.current = value;
    const token = UPGRADE_PARAM_TOKENS[value.toLowerCase()];
    if (token) {
      open(token);
      // The upgrade modal has no URL, so the central nav subscription can't
      // see this selection — emitted here instead (APP-444 A4).
      startNewFlow();
      trackWidgetSelected({
        widgetName: 'upgrade',
        previousWidget: pathnameToPreviousWidget(pathname),
        selectionMethod: 'deeplink',
        chainId
      });
    }
    setSearchParams(
      params => {
        params.delete(QueryParams.Upgrade);
        return params;
      },
      { replace: true }
    );
  }, [searchParams, open, setSearchParams, startNewFlow, trackWidgetSelected, pathname, chainId]);
}
