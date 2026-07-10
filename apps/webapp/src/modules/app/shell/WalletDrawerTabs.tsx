import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Trans } from '@lingui/react/macro';
import { BalancesHistory } from '@/widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { WalletDrawerAssets } from './WalletDrawerAssets';

enum WalletDrawerTab {
  ASSETS = 'assets',
  ACTIVITY = 'activity'
}

// Pill triggers per the wallet-preview redesign; the vendored Tabs variants
// are boxed, so the trigger styling lives here on the Radix primitive.
const pillTriggerClasses =
  'font-circle text-text rounded-full border px-3 py-2 text-sm font-medium leading-4 tracking-tight transition-colors ' +
  'border-[#bcb6ef]/20 hover:bg-white/5 light:border-[#1a1855]/20 light:hover:bg-[#1a1855]/5 ' +
  // bg-origin-border keeps the active gradient from tiling into the translucent border ring
  'bg-origin-border data-[state=active]:border-[#949aff]/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#949aff]/20 data-[state=active]:to-[#504dff]/20';

/** Assets/Activity tabs: wallet token balances with earn CTAs, and the shared history widget. */
export function WalletDrawerTabs() {
  const { onExternalLinkClicked } = useConfigContext();

  return (
    <Tabs defaultValue={WalletDrawerTab.ASSETS} className="flex min-h-0 flex-1 flex-col">
      <TabsPrimitive.List className="mb-6 flex gap-1.5 px-4">
        <TabsPrimitive.Trigger
          value={WalletDrawerTab.ASSETS}
          data-testid="wallet-drawer-tab-assets"
          className={pillTriggerClasses}
        >
          <Trans>Assets</Trans>
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger
          value={WalletDrawerTab.ACTIVITY}
          data-testid="wallet-drawer-tab-activity"
          className={pillTriggerClasses}
        >
          <Trans>Activity</Trans>
        </TabsPrimitive.Trigger>
      </TabsPrimitive.List>
      <TabsContent
        value={WalletDrawerTab.ASSETS}
        className="scrollbar-thin-always min-h-0 flex-1 overflow-auto"
      >
        <WalletDrawerAssets />
      </TabsContent>
      <TabsContent
        value={WalletDrawerTab.ACTIVITY}
        className="scrollbar-thin-always min-h-0 flex-1 overflow-auto px-4"
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
