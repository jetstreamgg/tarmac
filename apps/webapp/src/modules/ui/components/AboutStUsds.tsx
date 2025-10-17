import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { stUsdsAddress } from '@jetstreamgg/sky-hooks';
import { getBannerByIdAndModule, filterBannersByConnectionStatus } from '@/data/banners/helpers';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { useConnectedContext } from '../context/ConnectedContext';
import { AboutCard } from './AboutCard';

interface AboutStUsdsProps {
  module: string;
}

export const AboutStUsds = ({ module }: AboutStUsdsProps) => {
  const chainId = useChainId();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const stUsdsEtherscanLink = getEtherscanLink(
    chainId,
    stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    'address'
  );

  // expert-modules-banners is the overview page, use different gradient direction
  const isOverview = module === 'expert-modules-banners';
  const colorMiddle = isOverview
    ? 'linear-gradient(360deg, #F38FAA 0%, #EB63D9 300%)'
    : 'linear-gradient(0deg, #F38FAA 0%, #EB63D9 300%)';

  // Determine banner ID based on module and connection status
  // For overview + disconnected, try 'about-stusds' first, fall back to 'stusds'
  let banner = null;

  if (isOverview && !isConnectedAndAcceptedTerms) {
    banner = getBannerByIdAndModule('about-stusds', module);
  }

  // Fall back to 'stusds' if 'about-stusds' not found or not in overview mode
  if (!banner) {
    banner = getBannerByIdAndModule('stusds', module);
  }

  // Filter by connection status if banner has display property
  if (banner?.display) {
    const filtered = filterBannersByConnectionStatus([banner], isConnectedAndAcceptedTerms);
    banner = filtered.length > 0 ? filtered[0] : null;
  }

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
