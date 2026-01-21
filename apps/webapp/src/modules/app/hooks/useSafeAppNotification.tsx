import { Button } from '@/components/ui/button';
import { toastWithClose } from '@/components/ui/use-toast';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useEffect } from 'react';
import { useConnection } from 'wagmi';

const WALLET_CONNECT_CONNECTOR_ID = 'walletConnect';

export const useSafeAppNotification = () => {
  const { connector } = useConnection();
  const isSafeWallet = useIsSafeWallet();

  useEffect(() => {
    const toastDismissed = window.localStorage.getItem('safe-wallet-toast-dismissed');

    if (isSafeWallet && connector?.id === WALLET_CONNECT_CONNECTOR_ID && toastDismissed !== 'true') {
      toastWithClose(
        <div>
          <Text variant="medium" className="text-selectActive">
            {'Sky.money is a Safe{Wallet} Safe App'}
          </Text>
          <VStack className="mt-4 gap-4">
            <Text variant="medium">
              {'You can now open the app directly through your Safe{Wallet} interface.'}
              <br />
            </Text>
            <Button className="place-self-start">
              <ExternalLink
                href="https://app.safe.global/share/safe-app?appUrl=https%3A%2F%2Fapp.sky.money%2F"
                showIcon={false}
              >
                Open Safe{'{'}Wallet{'}'}
              </ExternalLink>
            </Button>
          </VStack>
        </div>,
        {
          duration: Infinity,
          dismissible: true,
          onDismiss: () => {
            window.localStorage.setItem('safe-wallet-toast-dismissed', 'true');
          }
        }
      );
    }
  }, [connector?.id, isSafeWallet]);
};
