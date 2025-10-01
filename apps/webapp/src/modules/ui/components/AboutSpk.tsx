import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { spkAddress } from '@jetstreamgg/sky-hooks';
import { GradientShapeCard } from './GradientShapeCard';
import { TokenIcon } from './TokenIcon';

export const AboutSpk = () => {
  const chainId = useChainId();

  const spkEtherscanLink = getEtherscanLink(
    chainId,
    spkAddress[chainId as keyof typeof spkAddress],
    'address'
  );

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(217.45% 249.6% at 116.69% 275.4%, #A273FF 0%, #4331E9 100%)"
      colorMiddle="linear-gradient(360deg, #FA43BD 0%, #FFA930 300%)"
      colorRight="#1e1a4b"
    >
      <div className="w-[80%] space-y-2 lg:w-2/3">
        <Heading className="flex items-center gap-2">
          <TokenIcon token={{ symbol: 'SPK' }} width={24} className="h-6 w-6" showChainIcon={false} />
          <Trans>SPK</Trans>
        </Heading>
        <Text variant="small">
          <Trans>
            SPK is the native governance and staking token of Spark. Designed with a long-term vision for
            sustainability, decentralization, and ecosystem alignment, SPK enables protocol governance,
            protocol security via staking, and reward distribution to participants.
          </Trans>
        </Text>
      </div>
      <ExternalLink href={spkEtherscanLink} showIcon={false} className="mt-3 w-fit lg:mt-0">
        <Button variant="outline" className="border-border gap-2">
          <Trans>View contract</Trans>
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
