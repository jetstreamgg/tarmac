import { getBannerByIdAndModule, filterBannersByConnectionStatus } from '@/data/banners/helpers';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { useConnectedContext } from '../context/ConnectedContext';
import { AboutCard } from './AboutCard';
import { TokenIcon } from './TokenIcon';
import { Trans } from '@lingui/react/macro';
import { Morpho } from '@jetstreamgg/sky-widgets';

const getVaultIcon = (bannerId: string) => {
  const morphoIcon = <Morpho className="h-6 w-6 rounded-sm" />;

  if (bannerId === 'flagship-vault') {
    return (
      <span className="flex items-center gap-1">
        {morphoIcon}
        <TokenIcon token={{ symbol: 'USDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
      </span>
    );
  }

  if (bannerId === 'risk-capital-vault') {
    return (
      <span className="flex items-center gap-1">
        {morphoIcon}
        <TokenIcon token={{ symbol: 'stUSDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
      </span>
    );
  }

  return morphoIcon;
};

export const AboutMorphoVaults = ({ bannerId = 'morpho-vaults' }: { bannerId?: string }) => {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const banner = getBannerByIdAndModule(bannerId, 'vaults-banners');

  if (!banner) return null;

  if (banner.display) {
    const filtered = filterBannersByConnectionStatus([banner], isConnectedAndAcceptedTerms);
    if (filtered.length === 0) return null;
  }

  const contentText = banner.description ? parseBannerContent(banner.description) : '';

  return (
    <AboutCard
      title={banner.title}
      icon={getVaultIcon(bannerId)}
      description={contentText}
      linkHref="https://morpho.org"
      linkLabel={<Trans>Learn more</Trans>}
      colorMiddle="linear-gradient(360deg, #2470FF 0%, #1B4ECF 300%)"
    />
  );
};
