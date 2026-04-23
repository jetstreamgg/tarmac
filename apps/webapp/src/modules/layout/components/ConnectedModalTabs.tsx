import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trans } from '@lingui/react/macro';
import { BalancesHistory, ModuleCardVariant, ModulesBalances } from '@jetstreamgg/sky-widgets';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChainId } from 'wagmi';
import { useModuleUrls } from '@/modules/app/hooks/useModuleUrls';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useGeoConfig } from '@/modules/geo-config';

enum ConnectedModalTabsEnum {
  SUPPLIED_FUNDS = 'supplied_funds',
  ACTIVITY = 'activity'
}

export function ConnectedModalTabs() {
  const chainId = useChainId();
  const { onExternalLinkClicked } = useConfigContext();
  const { isRegionRestricted } = useGeoConfig();

  const { rewardsUrl, savingsUrlMap, sealUrl, stakeUrl, expertOverviewUrl, vaultsUrl } = useModuleUrls();

  return (
    <Tabs defaultValue={ConnectedModalTabsEnum.SUPPLIED_FUNDS} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger position="left" value={ConnectedModalTabsEnum.SUPPLIED_FUNDS}>
          <Trans>Supplied funds</Trans>
        </TabsTrigger>
        <TabsTrigger position="right" value={ConnectedModalTabsEnum.ACTIVITY}>
          <Trans>Activity</Trans>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value={ConnectedModalTabsEnum.SUPPLIED_FUNDS}
        className="scrollbar-thin-always max-h-94 min-h-0 flex-1 overflow-auto [scrollbar-gutter:auto]"
      >
        <ModulesBalances
          variant={ModuleCardVariant.alt}
          chainIds={getSupportedChainIds(chainId)}
          rewardsCardUrl={rewardsUrl}
          savingsCardUrlMap={savingsUrlMap}
          sealCardUrl={sealUrl}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={expertOverviewUrl}
          vaultsCardUrl={vaultsUrl}
          hideRestrictedModules={isRegionRestricted}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      </TabsContent>
      <TabsContent
        value={ConnectedModalTabsEnum.ACTIVITY}
        className="scrollbar-thin-always max-h-94 min-h-0 flex-1 overflow-auto [scrollbar-gutter:auto]"
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
