import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { stakeModuleAddress } from '@jetstreamgg/sky-hooks';
import { GradientShapeCard } from './GradientShapeCard';

export const AboutStakeModule = () => {
  const chainId = useChainId();

  const stakeEtherscanLink = getEtherscanLink(
    chainId,
    stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    'address'
  );

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(258.73% 268.92% at 116.69% 275.4%, #F7A7F9 0%, #6D28FF 100%)"
      colorMiddle="linear-gradient(0deg, #F7A7F9 0%, #00DDFB 300%)"
      colorRight="bg-card"
      className="mb-6"
    >
      <div className="w-[80%] space-y-2 lg:w-1/2">
        <Heading>
          <Trans>About Staking Rewards</Trans>
        </Heading>
        <Text variant="small">
          <Trans>
            Staking Rewards can be accessed when SKY is supplied to the Staking Engine of the decentralized,
            non-custodial Sky Protocol. Staking Rewards rates are determined by Sky Ecosystem Governance
            through the process of decentralized onchain voting.
          </Trans>
        </Text>
      </div>
      <ExternalLink href={stakeEtherscanLink} showIcon={false} className="mt-3 w-fit lg:mt-0">
        <Button variant="outline" className="border-border gap-2">
          <Trans>View contract</Trans>
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
