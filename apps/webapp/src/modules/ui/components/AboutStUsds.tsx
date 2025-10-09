import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { stUsdsAddress } from '@jetstreamgg/sky-hooks';
import { getBannerById } from '@/data/banners/banners';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { useConnectedContext } from '../context/ConnectedContext';
import { AboutCard } from './AboutCard';

export const AboutStUsds = ({ isOverview = false }: { isOverview?: boolean }) => {
  const chainId = useChainId();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const stUsdsEtherscanLink = getEtherscanLink(
    chainId,
    stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    'address'
  );

  // Use different colorMiddle for overview vs details
  const colorMiddle = isOverview
    ? 'linear-gradient(360deg, #F38FAA 0%, #EB63D9 300%)'
    : 'linear-gradient(0deg, #F38FAA 0%, #EB63D9 300%)';

  // Determine banner ID based on connection status and isOverview
  const bannerId = isOverview
    ? isConnectedAndAcceptedTerms
      ? 'stusds-2'
      : 'stusds'
    : isConnectedAndAcceptedTerms
      ? 'stusds-4'
      : 'stusds-3';

  const banner = getBannerById(bannerId);
  const contentText = banner?.description ? parseBannerContent(banner.description) : '';

  return (
    <AboutCard
      tokenSymbol="stUSDS"
      description={contentText}
      linkHref={stUsdsEtherscanLink}
      colorMiddle={colorMiddle}
    />
  );
};
