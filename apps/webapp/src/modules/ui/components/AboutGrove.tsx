import { getEtherscanLink } from '@/utils';
import { useChainId } from 'wagmi';
import { groveAddress } from '@/hooks';
import { getBannerByIdAndModule } from '@/data/banners/helpers';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { AboutCard } from './AboutCard';

export const AboutGrove = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const groveEtherscanLink = getEtherscanLink(
    chainId,
    groveAddress[chainId as keyof typeof groveAddress],
    'address'
  );

  const banner = getBannerByIdAndModule('about-the-grove-token', 'rewards-banners');
  const contentText = banner?.description ? parseBannerContent(banner.description) : '';

  return (
    <AboutCard
      tokenSymbol="GROVE"
      description={contentText}
      linkHref={groveEtherscanLink}
      colorMiddle="linear-gradient(360deg, #E3D27A 0%, #04D19A 300%)"
      height={height}
    />
  );
};
