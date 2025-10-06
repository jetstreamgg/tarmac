import { getEtherscanLink, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { sUsdsAddress, sUsdsL2Address } from '@jetstreamgg/sky-hooks';
import { getBannerById } from '@/data/banners/banners';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { AboutCard } from './AboutCard';

export const AboutSUsds = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const sUsdsEtherscanLink = getEtherscanLink(
    chainId,
    isL2ChainId(chainId)
      ? sUsdsL2Address[chainId as keyof typeof sUsdsL2Address]
      : sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    'address'
  );

  const banner = getBannerById('susds');
  const contentText = banner?.description ? parseBannerContent(banner.description) : '';

  return (
    <AboutCard
      tokenSymbol="sUSDS"
      description={contentText}
      linkHref={sUsdsEtherscanLink}
      colorMiddle="linear-gradient(0deg, #FFEF79 0%, #00C2A1 300%)"
      height={height}
    />
  );
};
