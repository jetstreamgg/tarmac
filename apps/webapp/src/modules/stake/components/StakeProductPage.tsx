import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useChains, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Intent } from '@/lib/enums';
import { BP, productNetworks, useBreakpointIndex } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { IconboxStatus } from '@/components/ui/iconbox';
import { PageHeading } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useExitHold } from '@/modules/ui/hooks/useExitHold';
import { StakeUserPosition, useStakeUserPositions } from '../hooks/useStakeUserPositions';
import { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';
import { StakePositionsTab } from './StakePositionsTab';
import { StakeStatisticsTab } from './StakeStatisticsTab';
import { StakeAboutTab } from './StakeAboutTab';
import { OpenPositionTakeover } from './OpenPositionTakeover';
import { PositionManageFlow, manageActionInit } from './PositionManageFlow';

/** Matches the takeover dismissal in `components/product/TakeoverShell.tsx`. */
const TAKEOVER_EXIT_MS = 300;

// URL tab contract for the Stake destination page: `?tab=` selects the visible
// tab and always wins; without it (or with an unknown value) the default is
// `positions`, except when that tab would provably render its empty state —
// disconnected, or a settled positions query with zero urns — where the page
// lands on `statistics` instead (review feedback on the F-track PR).
const STAKE_TABS = ['positions', 'statistics', 'about'] as const;
type StakeTab = (typeof STAKE_TABS)[number];

function parseStakeTab(value: string | null, fallback: StakeTab): StakeTab {
  return STAKE_TABS.includes(value as StakeTab) ? (value as StakeTab) : fallback;
}

/**
 * Stake destination page: SKY-branded header + the three-tab strip
 * (My positions / Statistics / About) synced to `?tab=`. Stake is a destination,
 * not a ProductDetailTemplate consumer — the tabs compose L1 pieces directly.
 */
export function StakeProductPage() {
  const chains = useChains();
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.STAKE_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );

  const [searchParams, setSearchParams] = useAppSearchParams();
  // While the positions query is still loading the default stays `positions`
  // (its skeletons) — only a *known* empty state redirects the landing view.
  // A failed query also stays on `positions`: the tab renders its error
  // treatment there, which must not be hidden behind Statistics.
  const { address } = useConnection();
  const { data: positions, isLoading: positionsLoading } = useStakeUserPositions();
  const knownEmptyPositions = !positionsLoading && positions?.length === 0;
  const defaultTab: StakeTab = !address || knownEmptyPositions ? 'statistics' : 'positions';
  const tab = parseStakeTab(searchParams.get(QueryParams.Tab), defaultTab);
  // Route-driven overlays (Architecture §2.1): the F4 takeover mounts on
  // `flow=open`, the F5 manage flow (details modal ⇄ manage sheet) on
  // `flow=manage&urn_index=N`; closing returns to a clean URL.
  const isOpenFlow = searchParams.get(QueryParams.Flow) === 'open';
  const isManageFlow = searchParams.get(QueryParams.Flow) === 'manage';
  const holdManageFlow = useExitHold(isManageFlow, TAKEOVER_EXIT_MS);

  // Radix only fires onValueChange for a *different* tab, so clicking the
  // already-active trigger writes nothing — and the statistics default could
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
  const [pendingSheetInit, setPendingSheetInit] = useState<StakeManageFlowInit | null>(null);

  const onRemediate = useCallback(
    (position: StakeUserPosition, action: 'stake' | 'repay') => {
      setPendingSheetInit(manageActionInit(action));
      setSearchParams(
        params => {
          params.set(QueryParams.Flow, 'manage');
          params.set(QueryParams.UrnIndex, String(position.index));
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const onInitialSheetInitConsumed = useCallback(() => setPendingSheetInit(null), []);

  // Phone tier (comp 1295:20810): the header scales down (56px iconbox,
  // Heading 3 title at 24/26) and the network pill keeps its FULL "Ethereum"
  // label in the compact xs recipe — superseding the M3 icon-only treatment.
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  return (
    // Desktop comp 1222:15123 sets the title row 96px under the navbar
    // (APP-426 item 1), hence pt-24 over the sibling pages' pt.
    <div data-testid="stake-product-page" className="flex flex-col gap-16 py-4 md:gap-6 md:pt-24 md:pb-10">
      {/* Header (Patterns/Headers, Stake type 5043:59183): the DS 64px
          Iconbox / Status beside a Heading 2 title; the DS 17px icon-title gap
          is normalized to 16. The brand glow was dropped from product icons in
          the latest design iterations (APP-416). */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="shrink-0" data-testid="stake-header-icon">
            <IconboxStatus size="l" className="size-14 border-[1.75px] md:size-16 md:border-2">
              <TokenIcon
                token={{ symbol: 'SKY' }}
                width={48}
                className="h-11 w-11 md:h-12 md:w-12"
                showChainIcon={false}
              />
            </IconboxStatus>
          </div>
          <PageHeading
            size="lg"
            className="text-2xl leading-[26px] tracking-[-0.48px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]"
          >
            <Trans>SKY Staking</Trans>
          </PageHeading>
        </div>
        <ChainModal
          chainIds={networks}
          size={isMobile ? 'xs' : undefined}
          triggerClassName="h-8 md:h-10"
          dataTestId="stake-network"
        />
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList variant="nav" data-testid="stake-tabs">
          <TabsTrigger
            value="positions"
            variant="nav"
            onClick={() => onTabChange('positions')}
            data-testid="stake-tab-positions"
          >
            <Trans>My positions</Trans>
          </TabsTrigger>
          <TabsTrigger
            value="statistics"
            variant="nav"
            onClick={() => onTabChange('statistics')}
            data-testid="stake-tab-statistics"
          >
            <Trans>Statistics</Trans>
          </TabsTrigger>
          <TabsTrigger
            value="about"
            variant="nav"
            onClick={() => onTabChange('about')}
            data-testid="stake-tab-about"
          >
            <Trans>About</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" data-testid="stake-tab-content-positions" className="mt-5 md:mt-6">
          <StakePositionsTab onRemediate={onRemediate} />
        </TabsContent>
        <TabsContent value="statistics" data-testid="stake-tab-content-statistics" className="mt-5 md:mt-6">
          <StakeStatisticsTab />
        </TabsContent>
        <TabsContent value="about" data-testid="stake-tab-content-about" className="mt-5 md:mt-6">
          <StakeAboutTab />
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
          initialSheetInit={pendingSheetInit ?? undefined}
          onInitialSheetInitConsumed={onInitialSheetInitConsumed}
        />
      )}
    </div>
  );
}
