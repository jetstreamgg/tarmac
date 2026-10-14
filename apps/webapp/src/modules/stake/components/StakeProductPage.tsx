import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Intent } from '@/lib/enums';
import { BP, useBreakpointIndex, useProductNetworks } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { NetworkSelect, useNetworkTitleBadge } from '@/modules/ui/components/NetworkSelect';
import { IconboxStatus } from '@/components/ui/iconbox';
import { PageHeading } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useExitHold } from '@/modules/ui/hooks/useExitHold';
import { StakeUserPosition, useStakeUserPositions } from '../hooks/useStakeUserPositions';
import { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';
import { StakePositionsTab } from './StakePositionsTab';
import { StakeOverviewTab } from './StakeOverviewTab';
import { OpenPositionTakeover } from './OpenPositionTakeover';
import { PositionManageFlow, manageActionInit } from './PositionManageFlow';
import { FLOW_NAV_OPTIONS } from '../lib/flowNavigation';

/** Matches the takeover dismissal in `components/product/TakeoverShell.tsx`. */
const TAKEOVER_EXIT_MS = 300;

// URL tab contract for the Stake destination page: `?tab=` selects the visible
// tab and always wins; without it (or with an unknown value) the default is
// `positions`, except when that tab would provably render its empty state —
// disconnected, or a settled positions query with zero urns — where the page
// lands on `overview` instead (review feedback on the F-track PR).
const STAKE_TABS = ['overview', 'positions'] as const;
type StakeTab = (typeof STAKE_TABS)[number];

// Pre-APP-600 tabs folded into Overview; old deep links keep resolving.
const LEGACY_OVERVIEW_TABS = ['statistics', 'about'];

function parseStakeTab(value: string | null, fallback: StakeTab): StakeTab {
  if (value && LEGACY_OVERVIEW_TABS.includes(value)) return 'overview';
  return STAKE_TABS.includes(value as StakeTab) ? (value as StakeTab) : fallback;
}

/**
 * Stake destination page: SKY-branded header + the two-tab strip
 * (Overview / My positions) synced to `?tab=`. Stake is a destination,
 * not a ProductDetailTemplate consumer — the tabs compose L1 pieces directly.
 */
export function StakeProductPage() {
  const networks = useProductNetworks(Intent.STAKE_INTENT);

  const [searchParams, setSearchParams] = useAppSearchParams();
  // While the positions query is still loading the default stays `positions`
  // (its skeletons) — only a *known* empty state redirects the landing view.
  // A failed query also stays on `positions`: the tab renders its error
  // treatment there, which must not be hidden behind Overview.
  const { address } = useConnection();
  const { data: positions, isLoading: positionsLoading } = useStakeUserPositions();
  // The one positions read the rail card on every tab draws from.
  const rail = { positions, isLoading: positionsLoading };
  const knownEmptyPositions = !positionsLoading && positions?.length === 0;
  const defaultTab: StakeTab = !address || knownEmptyPositions ? 'overview' : 'positions';
  const tab = parseStakeTab(searchParams.get(QueryParams.Tab), defaultTab);
  // Route-driven overlays (Architecture §2.1): the F4 takeover mounts on
  // `flow=open`, the F5 manage flow (details modal ⇄ manage sheet) on
  // `flow=manage&urn_index=N`; closing returns to a clean URL.
  const isOpenFlow = searchParams.get(QueryParams.Flow) === 'open';
  const isManageFlow = searchParams.get(QueryParams.Flow) === 'manage';
  const holdManageFlow = useExitHold(isManageFlow, TAKEOVER_EXIT_MS);

  // Radix only fires onValueChange for a *different* tab, so clicking the
  // already-active trigger writes nothing — and the overview default could
  // then yank the view away when the positions query settles empty under the
  // user. Every trigger click pins its tab into the URL instead.
  const onTabChange = (value: string) => {
    setSearchParams(
      params => {
        params.set(QueryParams.Tab, value);
        return params;
      },
      { replace: true }
    );
  };

  // A row-banner remediation CTA can fire before the manage flow is even
  // mounted (it stages `flow=manage` itself); this carries the sheet
  // pre-toggle across that gap until the flow's own view state picks it up.
  // The Rewards section's Claim rides the same gap as 'claim'.
  const [pendingSheetInit, setPendingSheetInit] = useState<StakeManageFlowInit | 'claim' | null>(null);

  const stageManageFlow = useCallback(
    (position: StakeUserPosition, pending: StakeManageFlowInit | 'claim' | null) => {
      setPendingSheetInit(pending);
      setSearchParams(params => {
        params.set(QueryParams.Flow, 'manage');
        params.set(QueryParams.UrnIndex, String(position.index));
        return params;
      }, FLOW_NAV_OPTIONS);
    },
    [setSearchParams]
  );
  const onRemediate = useCallback(
    (position: StakeUserPosition, action: 'stake' | 'repay') =>
      stageManageFlow(position, manageActionInit(action)),
    [stageManageFlow]
  );
  const onInitialSheetInitConsumed = useCallback(() => setPendingSheetInit(null), []);

  // Phone tier (comp 1295:20810): the header scales down (56px iconbox,
  // Heading 3 title at 24/26) and the network pill keeps its FULL "Ethereum"
  // label in the compact xs recipe — superseding the M3 icon-only treatment.
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const networkBadge = useNetworkTitleBadge(networks, 'stake-network');

  return (
    // Desktop comp 1222:15123: corrected measurement (Figma Annotations R2
    // A2) puts the title row 80px under the navbar, not 96 — the previous
    // pt-24 was read as a deliberate navbar offset, but the reviewer's
    // remeasure supersedes that. The bottom is 72px, asymmetric from the top.
    <div data-testid="stake-product-page" className="flex flex-col gap-16 py-4 md:gap-6 md:pt-20 md:pb-18">
      {/* Header (Patterns/Headers, Stake type 5043:59183): the DS 64px
          Iconbox / Status beside a Heading 2 title; the DS 17px icon-title gap
          is normalized to 16. The brand glow was dropped from product icons in
          the latest design iterations (APP-416). */}
      {/* APP-600 header (3617:23736): description 28px under the title row,
          then 64px of padding plus the column's 24px gap — 88px to the tabs. */}
      <div className="flex flex-col gap-4 md:gap-7 md:pb-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="shrink-0" data-testid="stake-header-icon">
              <IconboxStatus size="l" className="size-14 md:size-16">
                <TokenIcon token={{ symbol: 'SKY' }} width={52} showChainIcon={false} />
              </IconboxStatus>
            </div>
            {/* Phone comp 1295:20810: Staking runs on one chain, so the phone
              header states it as the DS title-suffix badge beside the title
              (PageHeading's badge slot, 12px after the name, outside the h1)
              instead of a control-shaped pill with nothing to switch. Where a
              config lists several chains (dev's Tenderly fork) the dropdown
              stays. */}
            <PageHeading
              size="lg"
              className="text-2xl leading-[26px] tracking-[-0.48px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]"
              badges={networkBadge}
            >
              <Trans>SKY Staking</Trans>
            </PageHeading>
          </div>
          {!networkBadge && (
            <NetworkSelect
              chainIds={networks}
              size={isMobile ? 'xs' : undefined}
              triggerClassName="h-8 md:h-10"
              dataTestId="stake-network"
            />
          )}
        </div>
        <p
          data-testid="stake-header-description"
          className="text-fgSecondary max-w-[761px] text-xs leading-[18px]"
        >
          <Trans>
            Stake SKY to accrue rewards, have a voting power in Sky Protocol and optionally borrow USDS
            against your staked position. Unstake anytime: there is no lockup period.
          </Trans>
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList variant="nav" data-testid="stake-tabs">
          <TabsTrigger
            value="overview"
            variant="nav"
            onClick={() => onTabChange('overview')}
            data-testid="stake-tab-overview"
          >
            <Trans>Overview</Trans>
          </TabsTrigger>
          <TabsTrigger
            value="positions"
            variant="nav"
            onClick={() => onTabChange('positions')}
            data-testid="stake-tab-positions"
          >
            <Trans>My positions</Trans>
          </TabsTrigger>
        </TabsList>

        {/* Design QA (2800:91832): 40px from the tab pills to the content from
            md up; the phone tier keeps its 20px. The nav pills carry no
            padding of their own and the tab bodies start flush, so the
            margin IS the gap. */}
        <TabsContent value="overview" data-testid="stake-tab-content-overview" className="mt-5 md:mt-10">
          <StakeOverviewTab rail={rail} />
        </TabsContent>
        <TabsContent value="positions" data-testid="stake-tab-content-positions" className="mt-5 md:mt-10">
          <StakePositionsTab onRemediate={onRemediate} rail={rail} />
        </TabsContent>
      </Tabs>

      {/* The takeovers animate themselves (TakeoverShell), but the flow flags
          unmount them outright — without an AnimatePresence above the
          condition, closing one skips its exit entirely. */}
      <AnimatePresence>{isOpenFlow && <OpenPositionTakeover />}</AnimatePresence>
      {/* Held rather than wrapped in an AnimatePresence of its own: the flow
          owns one internally (its views swap behind it), and nesting the two
          breaks the exit. Closing empties the inner presence in the same tick,
          so an outer boundary sees nothing left to wait for, calls its exit
          done, and unmounts the subtree out from under the animation that had
          just started. Holding the mount lets the inner one finish. */}
      {holdManageFlow && (
        <PositionManageFlow
          initialSheetInit={pendingSheetInit && pendingSheetInit !== 'claim' ? pendingSheetInit : undefined}
          initialClaim={pendingSheetInit === 'claim'}
          onInitialSheetInitConsumed={onInitialSheetInitConsumed}
        />
      )}
    </div>
  );
}
