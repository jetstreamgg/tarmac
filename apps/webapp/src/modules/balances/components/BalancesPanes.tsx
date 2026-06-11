import { useChainId } from 'wagmi';
import { Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useGeoConfig } from '@/modules/geo-config';
import { useModuleUrls } from '@/modules/app/hooks/useModuleUrls';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { BalancesWidgetPane } from './BalancesWidgetPane';
import { BalancesDetails } from './BalancesDetails';

/**
 * Panes for the Balances module (the index route). Also rendered by the shell
 * as the fallback pair when the matched module is geo-restricted.
 */
export function BalancesPanes() {
  const { bpi } = useBreakpointIndex();
  const chainId = useChainId();
  const { isRegionRestricted } = useGeoConfig();
  const { hideZeroBalances, setHideZeroBalances, showAllNetworks, setShowAllNetworks } = useBalanceFilters();
  const { rewardsUrl, savingsUrlMap, stakeUrl, stusdsUrl, vaultsUrl, fixedYieldUrl } = useModuleUrls();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`balances-${bpi}`}
      widget={withErrorBoundary(
        <BalancesWidgetPane
          hideRestrictedModules={isRegionRestricted}
          rewardsCardUrl={isRegionRestricted ? undefined : rewardsUrl}
          savingsCardUrlMap={isRegionRestricted ? undefined : savingsUrlMap}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={isRegionRestricted ? undefined : stusdsUrl}
          vaultsCardUrl={vaultsUrl}
          fixedYieldCardUrl={fixedYieldUrl}
          chainIds={getSupportedChainIds(chainId)}
          hideZeroBalances={hideZeroBalances}
          setHideZeroBalances={setHideZeroBalances}
          showAllNetworks={showAllNetworks}
          setShowAllNetworks={setShowAllNetworks}
        />
      )}
      details={
        <DetailsLayout intent={Intent.BALANCES_INTENT}>
          <BalancesDetails />
        </DetailsLayout>
      }
    />
  );
}
