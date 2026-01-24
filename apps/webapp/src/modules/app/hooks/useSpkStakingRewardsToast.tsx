import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { SPK_STAKING_NOTIFICATION_KEY } from '@/lib/constants';
import { isTestnetId } from '@jetstreamgg/sky-utils';

const GOVERNANCE_PROPOSAL_URL =
  'https://vote.sky.money/executive/template-executive-vote-reduce-rewards-emissions-complete-guni-vault-offboardings-whitelist-keel-subproxy-to-send-cross-chain-messages-adjust-grove-dc-iam-parameters-delegate-compensation-star-agent-proxy-spells-january-15-2026';

export const useSpkStakingRewardsToast = (isAuthorized: boolean) => {
  const navigate = useNavigate();
  const chainId = useChainId();
  const isTestnet = isTestnetId(chainId);
  const networkParam = isTestnet ? 'tenderly' : 'ethereum';

  const onClose = useCallback(() => {
    localStorage.setItem(SPK_STAKING_NOTIFICATION_KEY, 'true');
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
              SPK Staking Rewards Update
            </Text>
            <VStack className="mt-4 gap-4">
              <Text variant="medium">
                SPK reward emissions have been reduced via the latest{' '}
                <ExternalLink
                  showIcon={false}
                  href={GOVERNANCE_PROPOSAL_URL}
                  className="inline text-blue-500 hover:underline"
                >
                  governance proposal
                </ExternalLink>
                . Consider switching to SKY rewards for your staking positions.
              </Text>
              <Button
                className="place-self-start"
                variant="pill"
                size="xs"
                onClick={() => {
                  navigate(`/?widget=stake&network=${networkParam}`);
                  toast.dismiss(toastId);
                  onClose();
                }}
              >
                Go to Staking
              </Button>
            </VStack>
          </div>
        ),
        {
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
