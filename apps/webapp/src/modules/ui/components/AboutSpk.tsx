import { Trans } from '@lingui/react/macro';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { spkAddress } from '@jetstreamgg/sky-hooks';
import { AboutCard } from './AboutCard';

export const AboutSpk = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const spkEtherscanLink = getEtherscanLink(
    chainId,
    spkAddress[chainId as keyof typeof spkAddress],
    'address'
  );

  return (
    <AboutCard
      tokenSymbol="SPK"
      description={
        <Trans>
          SPK is the native governance and staking token of Spark. Designed with a long-term vision for
          sustainability, decentralization, and ecosystem alignment, SPK enables protocol governance, protocol
          security via staking, and reward distribution to participants.
        </Trans>
      }
      linkHref={spkEtherscanLink}
      colorMiddle="linear-gradient(360deg, #FA43BD 0%, #FFA930 300%)"
      height={height}
    />
  );
};
