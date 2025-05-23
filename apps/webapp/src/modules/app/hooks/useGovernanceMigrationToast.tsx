import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

const TOAST_STORAGE_KEY = 'governance-migration-notice-shown';

export const useGovernanceMigrationToast = () => {
  useEffect(() => {
    const hasSeenToast = localStorage.getItem(TOAST_STORAGE_KEY);

    if (!hasSeenToast) {
      localStorage.setItem(TOAST_STORAGE_KEY, 'true');

      toast({
        title: (
          <Text variant="medium" className="text-selectActive">
            MKR to SKY Migration
          </Text>
        ),
        description: (
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
            <Button className="place-self-start" variant="pill" size="xs">
              <ExternalLink href="https://upgrademkrtosky.sky.money" showIcon={false}>
                Visit MKR to SKY Upgrade Hub
              </ExternalLink>
            </Button>
          </VStack>
        ),
        variant: 'info',
        duration: 15000
      });
    }
  }, []);
};
