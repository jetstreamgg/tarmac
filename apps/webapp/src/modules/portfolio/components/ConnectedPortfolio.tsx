import { useState } from 'react';
import { useChainId, useChains, useConnection, useEnsName } from 'wagmi';
import { useNavigate } from '@tanstack/react-router';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { useEarnMarketplace, useOverallSkyData } from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import { PageHeading } from '@/components/ui/page-header';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { buildSuppliedView } from '../helpers/suppliedView';
import { buildIdleSupplyInfo, buildIdleView } from '../helpers/idleView';
import { portfolioCallout, SIGNIFICANT_BALANCE_USD } from '../helpers/portfolioCallout';
import { useStablecoinBalances } from '../hooks/useStablecoinBalances';
import { PendleReadyToRedeemList } from '@/modules/pendle/components/PendleReadyToRedeemList';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import { PortfolioRewardsSections } from './PortfolioRewardsSections';
import { PortfolioTransactionsSection } from './PortfolioTransactionsSection';
import { PortfolioStatistics } from './PortfolioStatistics';
import { SavingsTvlCallout } from './SavingsTvlCallout';
import { AllocateStablecoinsBanner } from './AllocateStablecoinsBanner';
import { type PortfolioTab } from './PortfolioTabs';

/**
 * The Portfolio page for connected wallets: header, onboarding callout, the
 * stablecoin earnings card and positions section. Sub-$10 users additionally
 * see the Sky-wide statistics at the bottom — the same promotional surface
 * disconnected visitors get (gated on the settled `callout` signal).
 */
export function ConnectedPortfolio() {
  const connectedChainId = useChainId();
  const { rows, isLoading, totalDepositedUsd } = useEarnMarketplace();
  const { balances, isLoading: balancesLoading } = useStablecoinBalances();
  const { data: overallSkyData } = useOverallSkyData();
  const { address } = useConnection();
  const chains = useChains();
  const navigate = useNavigate();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  // 'all' or a chain id (as string, the FilterSelect value type).
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  // Supplied/Idle is shared across sections (earnings card + positions carousel).
  // Until the user picks a tab, it follows a data-derived default: Idle once it's
  // settled that there's no significant earn position. A manual choice then wins.
  const [userTab, setUserTab] = useState<PortfolioTab | null>(null);

  const network = selectedNetwork === 'all' ? 'all' : Number(selectedNetwork);
  const suppliedView = buildSuppliedView(rows, network);
  const idleView = buildIdleView(balances, network);
  // Best supply rate + venue count per token, for the idle table's rate badge.
  const idleSupplyInfo = buildIdleSupplyInfo(rows);

  // Sky Savings Rate as a decimal fraction (drives the Idle footer + projection).
  const savingsRate = overallSkyData?.skySavingsRatecRate
    ? parseFloat(overallSkyData.skySavingsRatecRate)
    : 0;
  const savingsTvlUsd = overallSkyData?.skySavingsRateTvl ? parseFloat(overallSkyData.skySavingsRateTvl) : 0;

  // Onboarding callout gates on family-wide totals (ignores the network filter),
  // and only after both data sources settle so it never flashes the wrong state.
  const idleTotalUsd = balances.reduce((acc, balance) => acc + balance.amountUsd, 0);
  const callout = isLoading || balancesLoading ? 'none' : portfolioCallout(totalDepositedUsd, idleTotalUsd);

  const tab = userTab ?? (!isLoading && totalDepositedUsd <= SIGNIFICANT_BALANCE_USD ? 'idle' : 'supplied');

  const goToSavings = () => void navigate({ to: ROUTES.EARN_SAVINGS, search: retainOnNavigate });

  // The filter lists every supported chain — idle balances may sit on a chain
  // where the user has no supplied position.
  const supportedChainIds = getSupportedChainIds(connectedChainId);
  const chainName = (id: number) => chains.find(chain => chain.id === id)?.name ?? `Chain ${id}`;

  // 24px chain icons: the header filter is the DS Button / Dropdown at size M
  // (Patterns/Headers 5034:21316), unlike the S-sized table filter bars.
  const networkOptions: FilterOption[] = supportedChainIds.map(id => ({
    value: String(id),
    label: (
      <span className="flex items-center gap-2">
        {getChainIcon(id, 'h-6 w-6')}
        {chainName(id)}
      </span>
    )
  }));

  const allNetworksLabel = (
    <span className="flex items-center gap-2">
      <IconStack size={24}>{supportedChainIds.map(id => getChainIcon(id, 'h-full w-full'))}</IconStack>
      <Trans>All networks</Trans>
    </span>
  );

  const displayName = ensName ?? (address ? formatAddress(address) : undefined);

  // The desktop px-calc insets the page to the middle 10 columns of the design
  // grid: (100% + gutter)/12 = one column + one gutter, exact at any width.
  return (
    <div
      className="desktop:px-[calc((100%+32px)/12)] flex w-full flex-col gap-6 py-4 md:py-10"
      data-testid="portfolio-page"
    >
      {/* Header (Patterns/Headers, Portfolio type 5034:20993): Label 5
          eyebrow over the Heading 3 + network-dropdown row. */}
      <div className="flex flex-col gap-2">
        {displayName && (
          <p className="font-circle text-fgSecondary text-sm leading-4 font-medium tracking-[-0.28px]">
            <Trans>Welcome back, {displayName}</Trans>
          </p>
        )}
        {/* M6.1 (486:20118): below md the title and the network dropdown stack,
            the dropdown going full-width 24px under the heading; from md the
            comp's desktop row (heading left, dropdown right) returns. */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-4">
          <PageHeading size="md">
            <Trans>Your Stablecoin Earnings</Trans>
          </PageHeading>
          <FilterSelect
            options={networkOptions}
            selected={selectedNetwork}
            onChange={setSelectedNetwork}
            allLabel={allNetworksLabel}
            testId="portfolio-network-filter"
            size="m"
            triggerClassName="w-full justify-between md:w-auto"
          />
        </div>
      </div>

      {callout === 'simulate' && <SavingsTvlCallout tvlUsd={savingsTvlUsd} savingsRate={savingsRate} />}
      {callout === 'allocate' && (
        <AllocateStablecoinsBanner
          idleUsd={idleTotalUsd}
          savingsRate={savingsRate}
          onAllocate={goToSavings}
        />
      )}

      <StablecoinEarningsCard
        suppliedView={suppliedView}
        suppliedLoading={isLoading}
        idleView={idleView}
        idleLoading={balancesLoading}
        savingsRate={savingsRate}
        tab={tab}
        onTabChange={setUserTab}
      />
      <PortfolioPositionsSection
        suppliedView={suppliedView}
        suppliedLoading={isLoading}
        idleView={idleView}
        idleSupplyInfo={idleSupplyInfo}
        idleLoading={balancesLoading}
        tab={tab}
        onTabChange={setUserTab}
      />

      {/* Claimable ecosystem + Merkl rewards, between the position cards and
          Transactions per the comp. Each section self-hides when empty. */}
      <PortfolioRewardsSections />

      {/* Portfolio-wide transactions (D8), after the position cards per the comp. */}
      <PortfolioTransactionsSection />

      {/* Matured PT redemption (G6): the marketplace filters matured markets out
          of the supplied view, so this self-hiding section is their only surface. */}
      <PendleReadyToRedeemList />

      {/* Sub-$10 users get the same Sky-wide statistics as disconnected visitors. */}
      {callout !== 'none' && <PortfolioStatistics />}
    </div>
  );
}
