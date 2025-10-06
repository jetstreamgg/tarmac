import { Trans } from '@lingui/react/macro';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { sealModuleAddress } from '@jetstreamgg/sky-hooks';
import { AboutCard } from './AboutCard';

export const AboutSealModule = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const sealEtherscanLink = getEtherscanLink(
    chainId,
    sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    'address'
  );

  return (
    <AboutCard
      title={<Trans>About Seal Rewards</Trans>}
      description={
        <Trans>
          Seal Rewards can be accessed when you supply MKR or SKY to the Seal Engine of the decentralised,
          non-custodial Sky Protocol. Currently, all Seal Rewards take the form of USDS. Eventually, subject
          to Sky ecosystem governance approval, Seal Rewards may also be available in the form of Sky Star
          tokens.
        </Trans>
      }
      linkHref={sealEtherscanLink}
      colorMiddle="linear-gradient(0deg, #F7A7F9 0%, #00DDFB 300%)"
      contentWidth="w-1/2"
      height={height}
    />
  );
};
