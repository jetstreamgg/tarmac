import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trans } from '@lingui/react/macro';
import { BalancesHistory, ModuleCardVariant, ModulesBalances } from '@/widgets';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChainId } from 'wagmi';
import { useModuleUrls } from '@/modules/app/hooks/useModuleUrls';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useGeoConfig } from '@/modules/geo-config';

enum WalletDrawerTab {
  ASSETS = 'assets',
  ACTIVITY = 'activity'
}

/** Assets/Activity tabs sharing the widget balance/history wiring. */
export function WalletDrawerTabs() {
  const chainId = useChainId();
  const { onExternalLinkClicked } = useConfigContext();
  const { isRegionRestricted } = useGeoConfig();

  const { rewardsUrl, savingsUrlMap, stakeUrl, stusdsUrl, vaultsUrl, fixedYieldUrl } = useModuleUrls();

  return (
    <Tabs defaultValue={WalletDrawerTab.ASSETS} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger position="left" value={WalletDrawerTab.ASSETS} data-testid="wallet-drawer-tab-assets">
          <Trans>Assets</Trans>
        </TabsTrigger>
        <TabsTrigger
          position="right"
          value={WalletDrawerTab.ACTIVITY}
          data-testid="wallet-drawer-tab-activity"
        >
          <Trans>Activity</Trans>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value={WalletDrawerTab.ASSETS}
        className="scrollbar-thin-always min-h-0 flex-1 overflow-auto [scrollbar-gutter:auto]"
      >
        <ModulesBalances
          variant={ModuleCardVariant.alt}
          chainIds={getSupportedChainIds(chainId)}
          rewardsCardUrl={rewardsUrl}
          savingsCardUrlMap={savingsUrlMap}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={stusdsUrl}
          vaultsCardUrl={vaultsUrl}
          fixedYieldCardUrl={fixedYieldUrl}
          hideRestrictedModules={isRegionRestricted}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      </TabsContent>
      <TabsContent
        value={WalletDrawerTab.ACTIVITY}
        className="scrollbar-thin-always min-h-0 flex-1 overflow-auto [scrollbar-gutter:auto]"
      >
        <BalancesHistory
          onExternalLinkClicked={onExternalLinkClicked}
          showAllNetworks={true}
          className="mt-0"
          useInfiniteScroll={true}
        />
      </TabsContent>
    </Tabs>
  );
}
