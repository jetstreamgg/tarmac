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

  // The desktop px-calc insets the page to the middle 10 columns of the design
  // grid: (100% + gutter)/12 = one column + one gutter, exact at any width.
  return (
    <div
      className="desktop:px-[calc((100%+32px)/12)] flex w-full flex-col gap-10 py-4 md:py-10"
      data-testid="portfolio-page"
    >
      <ConnectWalletCard />
      <EarnMarketplaceSection rows={rows} isLoading={isLoading} />
      <PortfolioStatistics />
    </div>
  );
}
