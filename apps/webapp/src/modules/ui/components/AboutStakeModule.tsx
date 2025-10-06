import { Trans } from '@lingui/react/macro';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { stakeModuleAddress } from '@jetstreamgg/sky-hooks';
import { AboutCard } from './AboutCard';

export const AboutStakeModule = () => {
  const chainId = useChainId();

  const stakeEtherscanLink = getEtherscanLink(
    chainId,
    stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    'address'
  );

  return (
    <AboutCard
      title={<Trans>About Staking Rewards</Trans>}
      description={
        <Trans>
          Staking Rewards can be accessed when SKY is supplied to the Staking Engine of the decentralized,
          non-custodial Sky Protocol. Staking Rewards rates are determined by Sky Ecosystem Governance through
          the process of decentralized onchain voting.
        </Trans>
      }
      linkHref={stakeEtherscanLink}
      colorMiddle="linear-gradient(0deg, #F7A7F9 0%, #00DDFB 300%)"
      contentWidth="w-1/2"
    />
  );
};
