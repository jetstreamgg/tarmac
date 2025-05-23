import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { GradientShapeCard } from './GradientShapeCard';

export const AboutCle = () => {
  return (
    <GradientShapeCard
      colorLeft="radial-gradient(200.08% 406.67% at 5.14% 108.47%, #4331E9 0%, #2A197D 21.68%)"
      colorMiddle="linear-gradient(43deg, #F7A7F9 -2.45%, #6D28FF 100%)"
      colorRight="#1e1a4b"
      className="mb-6"
    >
      <div className="w-[80%] space-y-2 lg:w-2/3">
        <Heading>
          <Trans>Chronicle</Trans>
        </Heading>
        <Text variant="small">
          <Trans>
            Chronicle Points are not a native feature of the Sky Protocol. Skybase International does not
            control or guarantee the availability, distribution or allocation of Chronicle Points or any other
            Chronicle funds. The Chronicle project operates independently of Sky.money and Skybase
            International. Please be aware that any engagement with Chronicle is at your own risk, and we bear
            no responsibility for any outcomes associated with this third-party system, or any funds
            associated with it.
          </Trans>
        </Text>
      </div>
      <ExternalLink href="https://chroniclelabs.org/" showIcon={false} className="mt-3 w-fit lg:mt-0">
        <Button variant="outline" className="border-border gap-2">
          <Trans>View Chronicle</Trans>
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
