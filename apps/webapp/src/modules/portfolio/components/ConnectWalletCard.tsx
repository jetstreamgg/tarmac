import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { Heading, Text } from '@/modules/layout/components/Typography';

/**
 * Top-of-page banner shown to disconnected visitors: a short pitch and the same
 * connect flow the header uses (terms gate included, via useCustomConnectModal).
 */
export function ConnectWalletCard() {
  const connect = useCustomConnectModal();

  return (
    <Card
      className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8"
      data-testid="portfolio-connect-card"
    >
      <div className="flex flex-col gap-2">
        <Heading tag="h2" variant="medium" className="max-w-md leading-snug">
          <Trans>Connect your wallet to see your balances and start earning</Trans>
        </Heading>
        <Text variant="small" className="text-textSecondary max-w-md">
          <Trans>
            Your portfolio, active positions, and available assets will appear here once connected.
          </Trans>
        </Text>
      </div>
      <Button variant="connect" onClick={connect} data-testid="portfolio-connect-card-button">
        <Trans>Connect wallet</Trans>
      </Button>
    </Card>
  );
}
