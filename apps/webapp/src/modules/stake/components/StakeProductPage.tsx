import { useCallback, useMemo, useState } from 'react';
import { useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Intent } from '@/lib/enums';
import { productNetworks } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { resolveTokenColor } from '@/widgets/shared/constants';
import { ProductTokenIcon } from '@/modules/ui/components/ProductTokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { RING_DEFAULT } from '@/components/product/productVisuals';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';
import { StakePositionsTab } from './StakePositionsTab';
import { StakeStatisticsTab } from './StakeStatisticsTab';
import { StakeAboutTab } from './StakeAboutTab';
import { OpenPositionTakeover } from './OpenPositionTakeover';
import { PositionManageFlow, manageActionInit } from './PositionManageFlow';

// URL tab contract for the Stake destination page: `?tab=` selects the visible
// tab; `positions` is the default and the fallback for any unknown value.
const STAKE_TABS = ['positions', 'statistics', 'about'] as const;
type StakeTab = (typeof STAKE_TABS)[number];
const DEFAULT_TAB: StakeTab = 'positions';

function parseStakeTab(value: string | null): StakeTab {
  return STAKE_TABS.includes(value as StakeTab) ? (value as StakeTab) : DEFAULT_TAB;
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
  const tab = parseStakeTab(searchParams.get(QueryParams.Tab));
  // Route-driven overlays (Architecture §2.1): the F4 takeover mounts on
  // `flow=open`, the F5 manage flow (details modal ⇄ manage sheet) on
  // `flow=manage&urn_index=N`; closing returns to a clean URL.
  const isOpenFlow = searchParams.get(QueryParams.Flow) === 'open';
  const isManageFlow = searchParams.get(QueryParams.Flow) === 'manage';

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

  return (
    <div data-testid="stake-product-page" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ProductTokenIcon
            symbol="SKY"
            ringColor={RING_DEFAULT}
            glowColor={resolveTokenColor('SKY')}
            width={48}
            className="h-12 w-12"
          />
          <h1 className="text-text text-3xl font-medium">
            <Trans>SKY Staking</Trans>
          </h1>
        </div>
        <ChainModal chainIds={networks} dataTestId="stake-network" />
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList data-testid="stake-tabs" className="flex w-fit gap-1 bg-transparent p-0">
          <TabsTrigger
            value="positions"
            className="nav-pill w-auto !rounded-full px-4 py-2 text-sm font-medium"
            data-testid="stake-tab-positions"
          >
            <Trans>My positions</Trans>
          </TabsTrigger>
          <TabsTrigger
            value="statistics"
            className="nav-pill w-auto !rounded-full px-4 py-2 text-sm font-medium"
            data-testid="stake-tab-statistics"
          >
            <Trans>Statistics</Trans>
          </TabsTrigger>
          <TabsTrigger
            value="about"
            className="nav-pill w-auto !rounded-full px-4 py-2 text-sm font-medium"
            data-testid="stake-tab-about"
          >
            <Trans>About</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" data-testid="stake-tab-content-positions" className="mt-6">
          <StakePositionsTab onRemediate={onRemediate} />
        </TabsContent>
        <TabsContent value="statistics" data-testid="stake-tab-content-statistics" className="mt-6">
          <StakeStatisticsTab />
        </TabsContent>
        <TabsContent value="about" data-testid="stake-tab-content-about" className="mt-6">
          <StakeAboutTab />
        </TabsContent>
      </Tabs>

      {isOpenFlow && <OpenPositionTakeover />}
      {isManageFlow && (
        <PositionManageFlow
          initialSheetInit={pendingSheetInit ?? undefined}
          onInitialSheetInitConsumed={onInitialSheetInitConsumed}
        />
      )}
    </div>
  );
}
