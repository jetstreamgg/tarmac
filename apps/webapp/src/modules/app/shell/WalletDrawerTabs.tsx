import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trans } from '@lingui/react/macro';
import { BalancesHistory } from './activity/BalancesHistory';
import { WalletDrawerAssets } from './WalletDrawerAssets';
import { BRIDGE_ENABLED } from '@/lib/constants';
import { BridgeActivityList } from '@/modules/bridge/components/BridgeActivityList';
import { useBridgeHistory } from '@/modules/bridge/hooks/useBridgeHistory';

enum WalletDrawerTab {
  ASSETS = 'assets',
  ACTIVITY = 'activity'
}

/** Assets/Activity tabs: wallet token balances with earn CTAs, and the shared history widget. */
export function WalletDrawerTabs() {
  const bridgeHistory = useBridgeHistory();
  const hasBridgeActivity = BRIDGE_ENABLED && bridgeHistory.length > 0;
  return (
    <Tabs defaultValue={WalletDrawerTab.ASSETS} className="flex min-h-0 flex-1 flex-col">
      {/* Base = the M4.6 mobile panel (20px content inset via the body's pl-3
          + px-2 here); md: restores the desktop drawer's 28px inset. */}
      <TabsList variant="pills" className="mb-4 px-2 md:mb-6 md:px-4">
        <TabsTrigger value={WalletDrawerTab.ASSETS} variant="pill" data-testid="wallet-drawer-tab-assets">
          <Trans>Assets</Trans>
        </TabsTrigger>
        <TabsTrigger value={WalletDrawerTab.ACTIVITY} variant="pill" data-testid="wallet-drawer-tab-activity">
          <Trans>Activity</Trans>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={WalletDrawerTab.ASSETS} className="min-h-0 flex-1 overflow-auto">
        <WalletDrawerAssets />
      </TabsContent>
      <TabsContent value={WalletDrawerTab.ACTIVITY} className="min-h-0 flex-1 overflow-auto px-2 md:px-4">
        {BRIDGE_ENABLED && <BridgeActivityList />}
        <BalancesHistory
          showAllNetworks={true}
          className="mt-0"
          useInfiniteScroll={true}
          hideEmptyState={hasBridgeActivity}
        />
      </TabsContent>
    </Tabs>
  );
}
