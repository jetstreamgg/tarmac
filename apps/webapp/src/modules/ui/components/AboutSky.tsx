import { Trans } from '@lingui/react/macro';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { skyAddress } from '@jetstreamgg/sky-hooks';
import { AboutCard } from './AboutCard';

export const AboutSky = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const skyEtherscanLink = getEtherscanLink(
    chainId,
    skyAddress[chainId as keyof typeof skyAddress],
    'address'
  );

  return (
    <AboutCard
      tokenSymbol="SKY"
      description={
        <Trans>
          SKY is a native governance token of the decentralised Sky ecosystem and the upgraded version of MKR.
          You can upgrade your MKR to SKY at the rate of 1:24,000, trade SKY for USDS and, soon, use it to
          accumulate Activation Token Rewards and participate in Sky ecosystem governance.
        </Trans>
      }
      linkHref={skyEtherscanLink}
      colorMiddle="linear-gradient(360deg, #6D28FF 0%, #F7A7F9 300%)"
      height={height}
    />
  );
};
