import { Trans } from '@lingui/react/macro';
import { getEtherscanLink } from '@/utils';
import { useChainId } from 'wagmi';
import { stakeModuleAddress } from '@/hooks';
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
          non-custodial Sky Protocol. Staking Rewards rates are determined by SKY token holders through
          decentralized onchain voting. Staking Reward rates are variable, can change at any time, and are not
          guaranteed.
        </Trans>
      }
      linkHref={stakeEtherscanLink}
      colorMiddle="linear-gradient(0deg, #F7A7F9 0%, #00DDFB 300%)"
      contentWidth="w-1/2"
    />
  );
};
