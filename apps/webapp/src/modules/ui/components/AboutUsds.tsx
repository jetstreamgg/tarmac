import { Trans } from '@lingui/react/macro';
import { getEtherscanLink, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { usdsAddress, usdsL2Address } from '@jetstreamgg/sky-hooks';
import { AboutCard } from './AboutCard';

export const AboutUsds = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const nstEtherscanLink = getEtherscanLink(
    chainId,
    isL2ChainId(chainId)
      ? usdsL2Address[chainId as keyof typeof usdsL2Address]
      : usdsAddress[chainId as keyof typeof usdsAddress],
    'address'
  );

  return (
    <AboutCard
      tokenSymbol="USDS"
      description={
        <Trans>
          USDS is the stablecoin of the decentralised Sky Protocol. It can be used in several ways, including
          to participate in the Sky Savings Rate and get Sky Token Rewards without giving up control. It is
          the upgraded version of DAI.
        </Trans>
      }
      linkHref={nstEtherscanLink}
      colorMiddle="linear-gradient(43deg, #FFD232 -2.45%, #FF6D6D 100%)"
      height={height}
    />
  );
};
