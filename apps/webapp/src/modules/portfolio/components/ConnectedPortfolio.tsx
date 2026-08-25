import { useEffect, useMemo, useState } from 'react';
import { useChainId, useChains, useConnection, useEnsName } from 'wagmi';
import { useGeoConfig } from '@/modules/geo-config';
import { useNavigate } from '@tanstack/react-router';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { isPendleChain, useEarnMarketplace, useOverallSkyData } from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import { readPortfolioDecision, writePortfolioDecision } from '@/lib/portfolioDecisionCache';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import { PageHeading } from '@/components/ui/page-header';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { buildSuppliedView } from '../helpers/suppliedView';
import { buildIdleSupplyInfo, buildIdleView } from '../helpers/idleView';
import { portfolioCallout, SIGNIFICANT_BALANCE_USD } from '../helpers/portfolioCallout';
import { useStablecoinBalances } from '../hooks/useStablecoinBalances';
import { useGeoVisibleRows } from '../hooks/useGeoVisibleRows';
import { useWalletEarnings } from '../hooks/useWalletEarnings';
import { filterWalletEarnings } from '../earnings/filterWalletEarnings';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import { usePendleMaturedPositions } from '@/modules/pendle/hooks/usePendleMaturedPositions';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import { PortfolioRewardsSections } from './PortfolioRewardsSections';
import { PortfolioTransactionsSection } from './PortfolioTransactionsSection';
import { PortfolioStatistics } from './PortfolioStatistics';
import { SavingsTvlCallout } from './SavingsTvlCallout';
import { AllocateStablecoinsBanner } from './AllocateStablecoinsBanner';
import { type PortfolioTab } from './PortfolioTabs';
import { setPendingNavIntent } from '@/modules/analytics/lib/navigationIntent';

/**
 * The Portfolio page for connected wallets: header, onboarding callout, the
 * stablecoin earnings card and positions section. Sub-$10 users additionally
 * see the Sky-wide statistics at the bottom — the same promotional surface
 * disconnected visitors get (gated on the settled `callout` signal).
 */
export function ConnectedPortfolio() {
  const connectedChainId = useChainId();
  const { rows, isLoading, isPositionsError } = useEarnMarketplace();
  const { balances, isLoading: balancesLoading, isError: balancesError } = useStablecoinBalances();
  // APP-450: aggregated per-wallet earnings (Total earned / Earned this month
  // in the card footer, "Already earned" on each position card).
  const walletEarnings = useWalletEarnings();
  // Geo-restricted positions are hidden from every Portfolio surface (APP-484),
  // so all totals/views build from the visible rows, and the savings promos
  // (callouts, idle-tab rate stats) drop when the savings module is restricted.
  const visibleRows = useGeoVisibleRows(rows);
  // "Every Portfolio surface" includes the earnings stats: a restricted
  // product's figures drop from the combined totals along with its row. The
  // filter names the geo-HIDDEN rows (rows minus visibleRows) so sources whose
  // rows are absent for other reasons — a matured Pendle market is delisted
  // from the marketplace while its closed position still earned — survive.
  // The network filter is deliberately NOT applied here: the accrued stats are
  // wallet-level, "total earnings this wallet made" (Kuba, 2026-08-24), while
  // the positions and supplied totals below do follow the selected network.
  const earnings = useMemo(() => {
    const visible = new Set(visibleRows.map(row => row.id));
    const hidden = new Set(rows.filter(row => !visible.has(row.id)).map(row => row.id));
    return filterWalletEarnings(walletEarnings, hidden);
  }, [walletEarnings, rows, visibleRows]);
  const { isModuleEnabled, isLoading: isGeoLoading } = useGeoConfig();
  const savingsAvailable = isGeoLoading || isModuleEnabled('savings');
  // The optimistic default above is safe for the settle path (the callout is
  // 'none' until every source lands) but not for the cached fast-path, which
  // renders before the module config resolves: a user without the savings
  // module would see the promo flash in and vanish once the config lands.
  // Cached promos wait for the settled config instead.
  const cachedPromoAvailable = !isGeoLoading && isModuleEnabled('savings');
  const { data: overallSkyData, isLoading: skyDataLoading } = useOverallSkyData();
  const { address } = useConnection();
  const chains = useChains();
  const navigate = useNavigate();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  // 'all' or a chain id (as string, the FilterSelect value type).
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  // Supplied/Idle is shared across sections (earnings card + positions carousel).
  // Until the user picks a tab, it follows the cached decision when there is
  // one, else a data-derived default: Idle once it's settled that there's no
  // significant earn position. A manual choice then wins.
  const [userTab, setUserTab] = useState<PortfolioTab | null>(null);
  // The last settled decision for this address (APP-419), frozen at mount: it
  // renders on first paint and never swaps mid-view — fresh data only rewrites
  // the cache below, so a changed outcome applies on the next mount instead.
  // PortfolioPage keys this component by address, so one mount is one account.
  const [cachedDecision] = useState(() => readPortfolioDecision(address));

  const network = selectedNetwork === 'all' ? 'all' : Number(selectedNetwork);
  const suppliedView = buildSuppliedView(visibleRows, network);
  // Matured PT rides beside suppliedView (the marketplace filters matured
  // markets out, so it can't come from the rows). Mainnet-only, so a non-pendle
  // network filter hides the cards like it hides mainnet positions.
  const { maturedPositions: allMaturedPositions, isLoading: maturedLoading } = usePendleMaturedPositions();
  const maturedPositions = network === 'all' || isPendleChain(network) ? allMaturedPositions : [];
  const idleView = buildIdleView(balances, network);
  // Best supply rate + venue count per token, for the idle table's rate badge.
  const idleSupplyInfo = buildIdleSupplyInfo(visibleRows);

  // Sky Savings Rate as a decimal fraction (drives the Idle footer + projection).
  // undefined while the query is in flight — the copy would otherwise quote
  // "today's 0.00% Sky Savings Rate" as fact.
  const savingsRate = skyDataLoading
    ? undefined
    : overallSkyData?.skySavingsRatecRate
      ? parseFloat(overallSkyData.skySavingsRatecRate)
      : 0;
  // undefined while the query is in flight — the callout chips the figure.
  const savingsTvlUsd = skyDataLoading
    ? undefined
    : overallSkyData?.skySavingsRateTvl
      ? parseFloat(overallSkyData.skySavingsRateTvl)
      : 0;

  // Onboarding callout gates on family-wide totals (ignores the network filter),
  // and only after all three data sources settle so it never flashes the wrong
  // state — geo included, since visibleRows can shrink when the config lands.
  // Visible totals only: a hidden restricted position mustn't suppress the
  // callout or claim the Supplied tab for a portfolio that renders as empty.
  //
  // A returning address renders its cached decision instead of waiting. First
  // visit (no cache, or expired) keeps the optimistic fallback: the simulate
  // callout stands in while loading — its copy and button are static, only the
  // TVL figure is data (chipped until it lands) — so the card doesn't pop in
  // and shove the earnings card down. That pins the `simulate` outcome
  // exactly; `allocate` (taller banner) and `none` (slot collapses) still
  // shift — the winner can't be known while loading.
  const depositedUsd = visibleRows.reduce((acc, row) => acc + (row.position?.totalUsd ?? 0), 0);
  const idleTotalUsd = balances.reduce((acc, balance) => acc + balance.amountUsd, 0);
  const calloutLoading = isLoading || balancesLoading || isGeoLoading;
  const callout = cachedDecision
    ? cachedDecision.outcome
    : calloutLoading
      ? 'none'
      : portfolioCallout(depositedUsd, idleTotalUsd);
  const optimisticSimulate = !cachedDecision && calloutLoading;

  // Once every source settles, persist the computed decision for the next
  // mount — this is the only thing fresh data changes mid-view, so it also
  // refreshes an existing hint's outcome and TTL without touching the render.
  // Never off failed data: an errored source settles as empty/zero totals,
  // and caching that would freeze a wrong outcome for the TTL.
  useEffect(() => {
    if (!address || calloutLoading || isPositionsError || balancesError) return;
    writePortfolioDecision(address, {
      outcome: portfolioCallout(depositedUsd, idleTotalUsd),
      tab: depositedUsd <= SIGNIFICANT_BALANCE_USD && allMaturedPositions.length === 0 ? 'idle' : 'supplied'
    });
  }, [
    address,
    calloutLoading,
    isPositionsError,
    balancesError,
    depositedUsd,
    idleTotalUsd,
    allMaturedPositions.length
  ]);

  // Matured PT needs action (Claim) and renders only on Supplied, so it wins
  // the default — and overrides a stale cached 'idle' from before maturity.
  const tab =
    userTab ??
    (maturedPositions.length > 0
      ? 'supplied'
      : (cachedDecision?.tab ??
        (!isLoading && !isGeoLoading && depositedUsd <= SIGNIFICANT_BALANCE_USD ? 'idle' : 'supplied')));

  const goToSavings = () => {
    setPendingNavIntent('card', ROUTES.EARN_SAVINGS);
    void navigate({ to: ROUTES.EARN_SAVINGS, search: retainOnNavigate });
  };

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

  // The stack is decoration on an "All networks" label, so it shows the leading
  // three chains rather than every supported one (Figma 2376:225130, "Limit
  // here to maximum 3 top networks"): past three the 8px-overlapped discs eat
  // the trigger's width and stop reading as distinct marks. The filter list
  // below still offers every chain.
  const stackedChainIds = supportedChainIds.slice(0, 3);

  const allNetworksLabel = (
    <span className="flex items-center gap-2">
      <IconStack size={24}>{stackedChainIds.map(id => getChainIcon(id, 'h-full w-full'))}</IconStack>
      <Trans>All networks</Trans>
    </span>
  );

  const displayName = ensName ?? (address ? formatAddress(address) : undefined);

  // The desktop px-calc insets the page to the middle 10 columns of the design
  // grid: (100% + gutter)/12 = one column + one gutter, exact at any width.
  // Section rhythm per the comps (1036:189460 desktop / 486:20104 mobile):
  // no uniform gap — each block carries its own top margin, 48/80 (mobile/md)
  // between major sections, 120 desktop bottom padding.
  return (
    <div
      className="desktop:px-[calc((100%+32px)/12)] flex w-full flex-col py-4 md:pt-20 md:pb-30"
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
          <PageHeading
            size="md"
            className="text-2xl leading-[26px] tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]"
          >
            <Trans>Your Stablecoin Savings</Trans>
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

      {/* Banner and earnings card group: 56/48 below the header, and a tight
          16 between banner and card when a callout shows (1036:188968). */}
      <div className="mt-14 flex flex-col gap-4 md:mt-12">
        {(optimisticSimulate || callout === 'simulate') &&
          (cachedDecision ? cachedPromoAvailable : savingsAvailable) && (
            <SavingsTvlCallout tvlUsd={savingsTvlUsd} savingsRate={savingsRate} />
          )}
        {callout === 'allocate' && (cachedDecision ? cachedPromoAvailable : savingsAvailable) && (
          <AllocateStablecoinsBanner
            // A cached `allocate` renders before the figures land — chip the
            // projection rather than flashing a $0/year built from empty data.
            idleUsd={balancesLoading || skyDataLoading ? undefined : idleTotalUsd}
            savingsRate={savingsRate}
            onAllocate={goToSavings}
          />
        )}

        <StablecoinEarningsCard
          suppliedView={suppliedView}
          suppliedLoading={isLoading}
          idleView={idleView}
          idleLoading={balancesLoading}
          savingsRate={savingsAvailable ? savingsRate : undefined}
          earnings={earnings}
          tab={tab}
          onTabChange={setUserTab}
        />
      </div>
      <div className="mt-12 md:mt-20">
        <PortfolioPositionsSection
          suppliedView={suppliedView}
          suppliedLoading={isLoading}
          maturedPositions={maturedPositions}
          maturedLoading={maturedLoading}
          idleView={idleView}
          idleSupplyInfo={idleSupplyInfo}
          idleLoading={balancesLoading}
          earnings={earnings}
          tab={tab}
          onTabChange={setUserTab}
        />
      </div>

      {/* Claimable ecosystem + Merkl rewards, between the position cards and
          Transactions per the comp. Each section self-hides when empty. */}
      <PortfolioRewardsSections />

      {/* Portfolio-wide transactions (D8), after the position cards per the comp. */}
      <div className="mt-12 md:mt-20">
        <PortfolioTransactionsSection />
      </div>

      {/* Sub-$10 users get the same Sky-wide statistics as disconnected visitors. */}
      {callout !== 'none' && (
        <div className="mt-12 md:mt-20">
          <PortfolioStatistics />
        </div>
      )}
    </div>
  );
}
