import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { spkAddress } from '@jetstreamgg/sky-hooks';
import { GradientShapeCard } from './GradientShapeCard';

export const AboutSpk = () => {
  const chainId = useChainId();

  const skyEtherscanLink = getEtherscanLink(
    chainId,
    spkAddress[chainId as keyof typeof spkAddress],
    'address'
  );

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(217.45% 249.6% at 116.69% 275.4%, #A273FF 0%, #4331E9 100%)"
      colorMiddle="linear-gradient(360deg, #FFD2B9 0%, #FF6D6D 300%)"
      colorRight="#1e1a4b"
    >
      <div className="w-[80%] space-y-2 lg:w-2/3">
        <Heading>
          <Trans>Spark</Trans>
        </Heading>
        <Text variant="small">
          <Trans>SPK is a token. Yup it sure is.</Trans>
        </Text>
      </div>
      <ExternalLink href={skyEtherscanLink} showIcon={false} className="mt-3 w-fit lg:mt-0">
        <Button variant="outline" className="border-border gap-2">
          <Trans>View contract</Trans>
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
