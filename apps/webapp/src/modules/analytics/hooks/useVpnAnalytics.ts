import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { AppEvents, safeCapture, getViewport, type VpnCheckResult, type BlockReason } from '../constants';

export function useVpnAnalytics() {
  const posthog = usePostHog();

  const trackVpnCheckCompleted = useCallback(
    ({
      isVpn,
      isRestrictedRegion,
      countryCode,
      result
    }: {
      isVpn: boolean | null;
      isRestrictedRegion: boolean | null;
      countryCode: string | null;
      result: VpnCheckResult;
    }) => {
      safeCapture(posthog, AppEvents.VPN_CHECK_COMPLETED, {
        is_vpn: isVpn,
        is_restricted_region: isRestrictedRegion,
        country_code: countryCode,
        result,
        viewport: getViewport()
      });
    },
    [posthog]
  );

  const trackVpnBlockedPageView = useCallback(
    ({ blockReason, countryCode }: { blockReason: BlockReason; countryCode: string | null }) => {
      safeCapture(posthog, AppEvents.VPN_BLOCKED_PAGE_VIEW, {
        block_reason: blockReason,
        country_code: countryCode,
        viewport: getViewport()
      });
    },
    [posthog]
  );

  return { trackVpnCheckCompleted, trackVpnBlockedPageView };
}
