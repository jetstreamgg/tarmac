import { useCallback, useEffect } from 'react';
import { useAppNavigate } from '@/lib/navigation';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { USDS_SKY_REWARDS_NOTIFICATION_KEY } from '@/lib/constants';

const GOVERNANCE_PROPOSAL_URL =
  'https://vote.sky.money/executive/template-executive-vote-reduce-rewards-emissions-complete-guni-vault-offboardings-whitelist-keel-subproxy-to-send-cross-chain-messages-adjust-grove-dc-iam-parameters-delegate-compensation-star-agent-proxy-spells-january-15-2026';

export const useUsdsSkyRewardsToast = (isAuthorized: boolean) => {
  const navigate = useAppNavigate();

  const onClose = useCallback(() => {
    localStorage.setItem(USDS_SKY_REWARDS_NOTIFICATION_KEY, 'true');
  }, []);

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
              The With: USDS Get: SKY reward has ended
            </Text>
            <VStack className="mt-4 gap-4">
              <Text variant="medium">
                This reward has ended via a{' '}
                <ExternalLink
                  showIcon={false}
                  href={GOVERNANCE_PROPOSAL_URL}
                  className="inline text-blue-500 hover:underline"
                >
                  governance proposal
                </ExternalLink>
                . Please withdraw your USDS and claim your earned SKY.
              </Text>
              <Button
                className="place-self-start"
                variant="pill"
                size="xs"
                onClick={() => {
                  // No `?network=`: the param is retired as app state (APP-547). The route
                  // guard resolves the chain when the destination needs one.
                  navigate('/earn?product=rewards');
                  toast.dismiss(toastId);
                  onClose();
                }}
              >
                Go to Rewards
              </Button>
            </VStack>
          </div>
        ),
        {
          id: 'usds-sky-rewards-toast',
          duration: Infinity,
          dismissible: true,
          onDismiss: onClose
        }
      );
    }, 1000); // 1 second delay

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthorized, navigate, onClose]);
};
