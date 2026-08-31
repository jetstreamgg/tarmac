import { useCallback, useEffect, useRef } from 'react';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { GOVERNANCE_MIGRATION_NOTIFICATION_KEY } from '@/lib/constants';
import { useUpgradeModal } from '@/modules/upgrade/hooks/useUpgradeModal';

export const useGovernanceMigrationToast = (isAuthorized: boolean) => {
  const onClose = useCallback(() => {
    localStorage.setItem(GOVERNANCE_MIGRATION_NOTIFICATION_KEY, 'true');
  }, []);

  // The CTA opens the in-app Upgrade modal (APP-413) instead of the external
  // upgrade hub. Read through a ref so the effect below keeps its single
  // isAuthorized dependency — `open` re-derives with the connected chain, and
  // re-running the effect would stack a duplicate toast.
  const { open: openUpgrade } = useUpgradeModal();
  const openUpgradeRef = useRef(openUpgrade);
  useEffect(() => {
    openUpgradeRef.current = openUpgrade;
  });

  useEffect(() => {
    // Only show if authorized by the notification queue
    if (!isAuthorized) {
      return;
    }

    // Add a small delay to ensure smooth UX
    const timer = setTimeout(() => {
      toastWithClose(
        toastId => (
          <div>
            <Text variant="medium" className="text-selectActive light:text-text">
              MKR to SKY Migration
            </Text>
            <VStack className="mt-4 gap-4">
              <Text variant="medium">
                Sky Ecosystem Governance has{' '}
                <ExternalLink
                  showIcon={false}
                  href="https://vote.makerdao.com/polling/QmTVd4iq"
                  className="inline text-blue-500 hover:underline"
                >
                  voted to make SKY the sole governance token
                </ExternalLink>{' '}
                of the Sky Protocol. MKR holders are encouraged to upgrade to SKY promptly to maintain the
                ability to participate in governance, maintain access to Staking Rewards and avoid the Delayed
                Upgrade Penalty.
              </Text>
              <Button
                className="place-self-start"
                variant="pill"
                size="xs"
                onClick={() => {
                  // Programmatic dismiss skips onDismiss — mark it seen here.
                  onClose();
                  toast.dismiss(toastId);
                  openUpgradeRef.current('MKR');
                }}
              >
                Upgrade MKR to SKY
              </Button>
            </VStack>
          </div>
        ),
        {
          duration: 15000,
          dismissible: true,
          onDismiss: onClose
        }
      );
    }, 1000); // 1 second delay

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthorized]);
};
