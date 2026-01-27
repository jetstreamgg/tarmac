import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { USDS_SKY_REWARDS_NOTIFICATION_KEY } from '@/lib/constants';
import { isTestnetId } from '@jetstreamgg/sky-utils';

const GOVERNANCE_PROPOSAL_URL =
  'https://vote.sky.money/executive/template-executive-vote-reduce-rewards-emissions-complete-guni-vault-offboardings-whitelist-keel-subproxy-to-send-cross-chain-messages-adjust-grove-dc-iam-parameters-delegate-compensation-star-agent-proxy-spells-january-15-2026';

export const useUsdsSkyRewardsToast = (isAuthorized: boolean) => {
  const navigate = useNavigate();
  const chainId = useChainId();
  const isTestnet = isTestnetId(chainId);
  const networkParam = isTestnet ? 'tenderly' : 'ethereum';

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
            <Text variant="medium" className="text-selectActive">
              USDS-SKY Rewards Update
            </Text>
            <VStack className="mt-4 gap-4">
              <Text variant="medium">
                SKY Rewards have been disabled via a{' '}
                <ExternalLink
                  showIcon={false}
                  href={GOVERNANCE_PROPOSAL_URL}
                  className="inline text-blue-500 hover:underline"
                >
                  governance proposal
                </ExternalLink>
                . Please withdraw your USDS and consider other reward options.
              </Text>
              <Button
                className="place-self-start"
                variant="pill"
                size="xs"
                onClick={() => {
                  navigate(`/?widget=rewards&network=${networkParam}`);
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
  }, [isAuthorized, navigate, onClose, networkParam]);
};
