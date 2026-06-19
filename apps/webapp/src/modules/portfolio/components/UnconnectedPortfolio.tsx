import { useEarnMarketplace } from '@/hooks';
import { ConnectWalletCard } from './ConnectWalletCard';
import { EarnMarketplaceSection } from './EarnMarketplaceSection';
import { PortfolioStatistics } from './PortfolioStatistics';

/**
 * The Portfolio page for disconnected visitors: a connect prompt, the Earn
 * marketplace as cards, and Sky-wide statistics. No user-specific sections —
 * those only render once a wallet is connected (see ConnectedPortfolio).
 */
export function UnconnectedPortfolio() {
  const { rows, isLoading } = useEarnMarketplace();

  return (
    <div className="flex w-full flex-col gap-10 p-4 md:px-8 md:py-10" data-testid="portfolio-page">
      <ConnectWalletCard />
      <EarnMarketplaceSection rows={rows} isLoading={isLoading} />
      <PortfolioStatistics />
    </div>
  );
}
