import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { getEtherscanLink, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { usdsAddress, usdsL2Address } from '@jetstreamgg/sky-hooks';
import { GradientShapeCard } from './GradientShapeCard';
import { TokenIcon } from './TokenIcon';

export const AboutUsds = () => {
  const chainId = useChainId();

  const nstEtherscanLink = getEtherscanLink(
    chainId,
    isL2ChainId(chainId)
      ? usdsL2Address[chainId as keyof typeof usdsL2Address]
      : usdsAddress[chainId as keyof typeof usdsAddress],
    'address'
  );

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(200.08% 406.67% at 5.14% 108.47%, #4331E9 0%, #2A197D 21.68%)"
      colorMiddle="linear-gradient(43deg, #FFD232 -2.45%, #FF6D6D 100%)"
      colorRight="#1e1a4b"
      className="mb-6"
    >
      <div className="w-[80%] space-y-2 lg:w-2/3">
        <Heading className="flex items-center gap-2">
          <TokenIcon token={{ symbol: 'USDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
          <Trans>USDS</Trans>
        </Heading>
        <Text variant="small">
          <Trans>
            USDS is the stablecoin of the decentralised Sky Protocol. It can be used in several ways,
            including to participate in the Sky Savings Rate and get Sky Token Rewards without giving up
            control. It is the upgraded version of DAI.
          </Trans>
        </Text>
      </div>
      <ExternalLink href={nstEtherscanLink} showIcon={false} className="mt-3 w-fit lg:mt-0">
        <Button variant="outline" className="border-border gap-2">
          <Trans>View contract</Trans>
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
