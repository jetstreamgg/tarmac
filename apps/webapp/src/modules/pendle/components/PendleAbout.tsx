import { Trans } from '@lingui/react/macro';
import { getBannerByIdAndModule, filterBannersByConnectionStatus } from '@/data/banners/helpers';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { AboutCard } from '@/modules/ui/components/AboutCard';
import { Pendle } from '@/modules/icons';

export const PendleAbout = () => {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const banner = getBannerByIdAndModule('fixed-yield', 'fixed-yield-banners');
  if (!banner) return null;

  if (banner.display) {
    const filtered = filterBannersByConnectionStatus([banner], isConnectedAndAcceptedTerms);
    if (filtered.length === 0) return null;
  }

  const description = banner.description ? parseBannerContent(banner.description) : '';

  return (
    <AboutCard
      title={<Trans>{banner.title}</Trans>}
      icon={<Pendle className="h-6 w-6" />}
      description={description}
      colorMiddle="linear-gradient(360deg, #6D28FF 0%, #F7A7F9 300%)"
    />
  );
};
