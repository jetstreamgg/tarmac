import { useEffect, useMemo, useState } from 'react';
import { useConnection, useEnsName } from 'wagmi';
import { useGeoConfig } from '@/modules/geo-config';
import { useNavigate } from '@tanstack/react-router';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { useEarnMarketplace, useOverallSkyData } from '@/hooks';
import { formatAddress } from '@/utils';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import { readPortfolioDecision, writePortfolioDecision } from '@/lib/portfolioDecisionCache';
import { PageHeading } from '@/components/ui/page-header';
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
  const navigate = useNavigate();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

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

  const suppliedView = buildSuppliedView(visibleRows);
  // Matured PT rides beside suppliedView (the marketplace filters matured
  // markets out, so it can't come from the rows).
  const { maturedPositions, isLoading: maturedLoading } = usePendleMaturedPositions();
  const idleView = buildIdleView(balances);
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

  // Onboarding callout gates on family-wide totals, and only after all three
  // data sources settle so it never flashes the wrong
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
  // Matured PT is still capital in the protocol even though the marketplace
  // rows drop it — a matured-only wallet gets the Claim card, never the
  // get-started pitch its $0 depositedUsd would otherwise pick.
  const hasMatured = !maturedLoading && maturedPositions.length > 0;
  const callout = hasMatured
    ? 'none'
    : cachedDecision
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
    if (!address || calloutLoading || maturedLoading || isPositionsError || balancesError) return;
    writePortfolioDecision(address, {
      outcome: maturedPositions.length > 0 ? 'none' : portfolioCallout(depositedUsd, idleTotalUsd),
      tab: depositedUsd <= SIGNIFICANT_BALANCE_USD && maturedPositions.length === 0 ? 'idle' : 'supplied'
    });
  }, [
    address,
    calloutLoading,
    maturedLoading,
    isPositionsError,
    balancesError,
    depositedUsd,
    idleTotalUsd,
    maturedPositions.length
  ]);

  // Matured PT needs action and renders only on Supplied, so it wins the
  // default (overriding a stale pre-maturity cached 'idle'). The uncached
  // idle default waits for the matured read like it waits for positions —
  // deciding on the in-flight empty list would mount Idle, then yank.
  const tab =
    userTab ??
    (maturedPositions.length > 0
      ? 'supplied'
      : (cachedDecision?.tab ??
        (!isLoading && !isGeoLoading && !maturedLoading && depositedUsd <= SIGNIFICANT_BALANCE_USD
          ? 'idle'
          : 'supplied')));

  const goToSavings = () => {
    setPendingNavIntent('card', ROUTES.EARN_SAVINGS);
    void navigate({ to: ROUTES.EARN_SAVINGS, search: retainOnNavigate });
  };

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
          eyebrow over the Heading 3. The comp's network dropdown is gone
          (APP-547): there is no global network filter, positions carry their
          own chain mark instead. */}
      <div className="flex flex-col gap-2">
        {displayName && (
          <p className="font-circle text-fgSecondary text-sm leading-4 font-medium tracking-[-0.28px]">
            <Trans>Welcome back, {displayName}</Trans>
          </p>
        )}
        <PageHeading
          size="md"
          className="text-2xl leading-[26px] tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]"
        >
          <Trans>Your Stablecoin Savings</Trans>
        </PageHeading>
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
