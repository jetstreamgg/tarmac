import { getBannerByIdAndModule, filterBannersByConnectionStatus } from '@/data/banners/helpers';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { useConnectedContext } from '../context/ConnectedContext';
import { AboutCard } from './AboutCard';
import { TokenIcon } from './TokenIcon';
import { Trans } from '@lingui/react/macro';
import { Morpho } from '@/widgets';
import { VaultProvider } from '@/hooks';

const getVaultIcon = (bannerId: string) => {
  const morphoIcon = <Morpho className="h-6 w-6 rounded-sm" />;

  // Tether Savings is a Sky vault on Spark infra — show the deposit-asset icon, not the Morpho mark.
  if (bannerId === 'tether-savings-vault') {
    return <TokenIcon token={{ symbol: 'USDT' }} width={24} className="h-6 w-6" showChainIcon={false} />;
  }

  if (bannerId === 'flagship-vault') {
    return (
      <span className="flex items-center gap-1">
        {morphoIcon}
        <TokenIcon token={{ symbol: 'USDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
      </span>
    );
  }

  if (bannerId.endsWith('risk-capital-vault')) {
    return (
      <span className="flex items-center gap-1">
        {morphoIcon}
        <TokenIcon token={{ symbol: 'stUSDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
      </span>
    );
  }

  if (bannerId.endsWith('savings-vault')) {
    return (
      <span className="flex items-center gap-1">
        {morphoIcon}
        <TokenIcon token={{ symbol: 'sUSDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
      </span>
    );
  }

  return morphoIcon;
};

export const AboutMorphoVaults = ({
  bannerId = 'vaults',
  provider = 'morpho'
}: {
  bannerId?: string;
  provider?: VaultProvider;
}) => {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const banner = getBannerByIdAndModule(bannerId, 'vaults-banners');

  if (!banner) return null;

  if (banner.display) {
    const filtered = filterBannersByConnectionStatus([banner], isConnectedAndAcceptedTerms);
    if (filtered.length === 0) return null;
  }

  const contentText = banner.description ? parseBannerContent(banner.description) : '';

  // The Sky (sUSDT) vault points at Sky docs; Morpho vaults keep the Morpho concept docs.
  const linkHref =
    provider === 'sky' ? 'https://docs.sky.money/' : 'https://docs.morpho.org/learn/concepts/vault-v2/';

  return (
    <AboutCard
      title={banner.title}
      icon={getVaultIcon(bannerId)}
      description={contentText}
      linkHref={linkHref}
      linkLabel={<Trans>Learn more</Trans>}
      colorMiddle="linear-gradient(360deg, #2470FF 0%, #1B4ECF 300%)"
    />
  );
};
