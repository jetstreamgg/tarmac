import React, { useEffect, useRef, useMemo } from 'react';
import { Ban, TriangleAlert } from 'lucide-react';
import { useDisconnect } from 'wagmi';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { sanitizeUrl } from '@/lib/utils';
import { useVpnAnalytics } from '@/modules/analytics/hooks/useVpnAnalytics';
import { type BlockReason } from '@/modules/analytics/constants';
import { type AccessBlockReason } from '@/modules/ui/context/ConnectedContext';
import {
  type TermsLink,
  getTermsLinkConfig,
  reportTermsLinkConfigErrorOnce
} from '@/modules/config/termsLink';

type AuthData = {
  addressAllowed?: boolean;
  authIsLoading?: boolean;
  address?: string;
  authError?: Error;
};

type VpnData = {
  isConnectedToVpn?: boolean;
  isRestrictedRegion?: boolean;
  vpnIsLoading?: boolean;
  vpnError?: Error;
  countryCode?: string | null;
};

type UnauthorizedPageProps = {
  authData: AuthData;
  vpnData: VpnData;
  blockReason?: AccessBlockReason;
  /** Re-runs the failed checks — wired to the "unavailable" states only. */
  onRetry?: () => void;
  children?: React.ReactNode;
};

const ANALYTICS_REASON: Record<AccessBlockReason, BlockReason> = {
  'region-restricted': 'restricted_region',
  'ip-check-unavailable': 'network_error',
  'wallet-blocked': 'address_restricted',
  'screening-unavailable': 'auth_error'
};

const TermsOfUseLink = ({ termsLinks }: { termsLinks: TermsLink[] }) =>
  Array.isArray(termsLinks) && termsLinks.length > 0 ? (
    <ExternalLink className="text-textEmphasis" showIcon={false} href={sanitizeUrl(termsLinks[0].url)}>
      {termsLinks[0].name}
    </ExternalLink>
  ) : (
    <>Terms of Use</>
  );

export const UnauthorizedPage = ({
  authData,
  vpnData,
  blockReason,
  onRetry,
  children
}: UnauthorizedPageProps) => {
  const { trackVpnBlockedPageView } = useVpnAnalytics();
  const { disconnect } = useDisconnect();
  const blockedTrackedRef = useRef(false);

  const isLoading = useMemo(
    () => authData.authIsLoading || vpnData.vpnIsLoading,
    [authData.authIsLoading, vpnData.vpnIsLoading]
  );

  useEffect(() => {
    if (blockedTrackedRef.current || isLoading) return;
    blockedTrackedRef.current = true;

    trackVpnBlockedPageView({
      blockReason: blockReason ? ANALYTICS_REASON[blockReason] : 'unknown',
      countryCode: vpnData.countryCode ?? null
    });
  }, [isLoading, blockReason, vpnData.countryCode, trackVpnBlockedPageView]);

  const { termsLinks } = getTermsLinkConfig();

  useEffect(() => {
    reportTermsLinkConfigErrorOnce({
      module: 'auth',
      flow: 'unauthorized-page',
      action: 'parse-terms-link',
      type: 'config_error'
    });
  }, []);

  // Each reason gets a visibly distinct state, and in particular an
  // unavailable check reads as "try again later", never as a block (APP-497).
  // No contact/recourse route on the blocked states for now: the
  // compliance mailing group won't be created yet (Kacper, 10 Aug 2026).
  const stateContent = () => {
    switch (blockReason) {
      case 'region-restricted':
        return {
          icon: <Ban className="text-error size-5 shrink-0" />,
          title: t`Access blocked`,
          message: (
            <Trans>
              Sky.money isn&apos;t available in your region. For more information, please refer to our{' '}
              <TermsOfUseLink termsLinks={termsLinks} />.
            </Trans>
          ),
          actions: null
        };
      case 'wallet-blocked':
        return {
          icon: <Ban className="text-error size-5 shrink-0" />,
          title: t`Wallet blocked`,
          message: (
            <Trans>
              This wallet address can&apos;t be used with Sky.money. For more information, please refer to our{' '}
              <TermsOfUseLink termsLinks={termsLinks} />.
            </Trans>
          ),
          actions: (
            <Button variant="secondary" size="l" className="w-full" onClick={() => disconnect()}>
              <Trans>Disconnect wallet</Trans>
            </Button>
          )
        };
      case 'screening-unavailable':
        return {
          icon: <TriangleAlert className="text-error size-5 shrink-0" />,
          title: t`Unable to verify this wallet`,
          message: (
            <Trans>
              We couldn&apos;t run the checks required before a wallet can be used with Sky.money. This is
              usually temporary — please check again in a few minutes.
            </Trans>
          ),
          actions: (
            <div className="flex w-full gap-4">
              <Button variant="secondary" size="l" className="flex-1" onClick={() => disconnect()}>
                <Trans>Disconnect wallet</Trans>
              </Button>
              <Button variant="primary" size="l" className="flex-1" onClick={onRetry}>
                <Trans>Check again</Trans>
              </Button>
            </div>
          )
        };
      case 'ip-check-unavailable':
      default:
        return {
          icon: <TriangleAlert className="text-error size-5 shrink-0" />,
          title: t`Network error`,
          message: (
            <Trans>
              We couldn&apos;t verify that Sky.money is available in your region. Please check your connection
              and try again.
            </Trans>
          ),
          actions: (
            <Button variant="primary" size="l" className="w-full" onClick={onRetry}>
              <Trans>Try again</Trans>
            </Button>
          )
        };
    }
  };

  const { icon, title, message, actions } = stateContent();

  return (
    <>
      {/* While the checks are in flight this renders nothing: WalletChip's
          ConnectChecksCover holds the screen for the whole connect-time
          sequence (screening, then the terms check), so the spinner doesn't
          restart between them. This component mounts in two places at once
          (here and AuthWrapper), which is the other reason the wait can't live
          in it — two scrims would stack.

          The dialog therefore mounts only once the verdict is in, which is
          also what stops it resizing: it used to stay open across the swap
          from the 300px waiting card to this 500px one, and DialogContent's
          `transition: all 300ms` animated that as a widening. */}
      {!isLoading && (
        <Dialog open={true}>
          <DialogContent
            aria-describedby={undefined}
            className="bg-containerDark w-full max-w-[500px] gap-8 p-8 sm:min-w-[500px] sm:p-8"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {icon}
                <DialogTitle asChild>
                  <Text className="text-text font-circle text-xl">{title}</Text>
                </DialogTitle>
              </div>
              <Text className="font-graphik text-textSecondary text-sm">{message}</Text>
            </div>
            {actions}
          </DialogContent>
        </Dialog>
      )}
      {children}
    </>
  );
};
