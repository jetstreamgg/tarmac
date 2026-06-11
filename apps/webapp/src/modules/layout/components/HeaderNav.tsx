import { MouseEvent, useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useChainId } from 'wagmi';
import { Menu } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { Intent } from '@/lib/enums';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { INTENT_PATHS, retainOnNavigate, useRouteIntent } from '@/lib/navigation';
import { getNetworkOverrideForIntent } from '@/lib/widget-network-map';
import { cn } from '@/lib/utils';
import { useWidgetItems } from '@/modules/app/hooks/useWidgetItems';
import { useNewIntentDots } from '@/modules/app/hooks/useNewIntentDots';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useRouteRewardContract } from '@/modules/rewards/hooks/useRouteRewardContract';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { type SelectionMethod } from '@/modules/analytics/constants';
import { Text } from '@/modules/layout/components/Typography';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

/**
 * Module navigation state shared by the desktop header nav and the mobile
 * drawer: the nav items (geo-filtered, with coming-soon state), the active
 * module, and the side effects of a module selection (analytics flow +
 * network auto-switch feedback). Navigation itself stays declarative — every
 * item is a router Link whose search params carry the network override.
 */
function useModuleNavigation() {
  const routeIntent = useRouteIntent();
  const chainId = useChainId();
  const { widgetContent, effectiveIntent } = useWidgetItems(routeIntent);
  const { showNewDot } = useNewIntentDots();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();
  const { trackWidgetSelected } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  const items = widgetContent.flatMap(group => group.items);

  // Mainnet-only modules force network=ethereum when leaving an L2, so the
  // Link href itself carries the switch (cmd-click and copy-link included).
  const searchForIntent = useCallback(
    (targetIntent: Intent) => (prev: Record<string, string | undefined>) => {
      const retained = retainOnNavigate(prev);
      const override = getNetworkOverrideForIntent(targetIntent, chainId);
      if (override) retained[QueryParams.Network] = override;
      return retained;
    },
    [chainId]
  );

  const handleNavClick = useCallback(
    (targetIntent: Intent, method: SelectionMethod) => (event: MouseEvent) => {
      // Modified clicks open a new tab; this tab doesn't navigate, so skip
      // the selection side effects.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (targetIntent !== effectiveIntent) {
        startNewFlow();
        trackWidgetSelected({
          widgetName: IntentMapping[targetIntent] || targetIntent,
          previousWidget: IntentMapping[effectiveIntent] || 'balances',
          selectionMethod: method,
          chainId: chainId || 0
        });
      }
      if (getNetworkOverrideForIntent(targetIntent, chainId)) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
      }
    },
    [effectiveIntent, chainId, startNewFlow, trackWidgetSelected, setIsSwitchingNetwork, setIsAutoSwitching]
  );

  return { activeIntent: effectiveIntent, items, showNewDot, searchForIntent, handleNavClick };
}

type ModuleNavLinkProps = {
  targetIntent: Intent;
  search: (prev: Record<string, string | undefined>) => Record<string, string>;
  onClick: (event: MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
};

/** Link to a module path. Rewards keeps the selected reward contract as a detail route. */
function ModuleNavLink({ targetIntent, search, onClick, className, children }: ModuleNavLinkProps) {
  const selectedRewardContract = useRouteRewardContract();
  const rewardContract =
    targetIntent === Intent.REWARDS_INTENT ? selectedRewardContract?.contractAddress : undefined;

  if (rewardContract) {
    return (
      <Link
        to="/rewards/$rewardContract"
        params={{ rewardContract }}
        search={search}
        onClick={onClick}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link to={INTENT_PATHS[targetIntent]} search={search} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

const soonPillClasses =
  'from-primary-start/100 to-primary-end/100 text-textSecondary rounded-full bg-radial-(--gradient-position) px-1.5 py-0.5 text-[10px]';

/** Center module navigation of the redesigned header (lg+). */
export function HeaderNav() {
  const { activeIntent, items, showNewDot, searchForIntent, handleNavClick } = useModuleNavigation();

  return (
    <nav className="hidden items-center gap-1 lg:flex" data-testid="widget-navigation">
      {items.map(([widgetIntent, label, , comingSoon, options]) => {
        if (comingSoon || options?.disabled) {
          return (
            <span
              key={widgetIntent}
              className="text-textSecondary/50 flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <Trans>{label}</Trans>
              {comingSoon && (
                <Text variant="small" className={soonPillClasses}>
                  <Trans>Soon</Trans>
                </Text>
              )}
            </span>
          );
        }
        return (
          <ModuleNavLink
            key={widgetIntent}
            targetIntent={widgetIntent}
            search={searchForIntent(widgetIntent)}
            onClick={handleNavClick(widgetIntent, 'header_nav')}
            className={cn(
              'text-textSecondary hover:text-text relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeIntent === widgetIntent && 'bg-surface text-text'
            )}
          >
            <Trans>{label}</Trans>
            {showNewDot(widgetIntent) && (
              <span className="bg-textEmphasis absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
            )}
          </ModuleNavLink>
        );
      })}
    </nav>
  );
}

/** Hamburger drawer with the module navigation for mobile and tablet (below lg). */
export function HeaderNavDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { activeIntent, items, showNewDot, searchForIntent, handleNavClick } = useModuleNavigation();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-bgPrimary border-borderPrimary rounded-xl lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={24} className="text-text" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="border-borderPrimary w-[280px] bg-black/10 p-0 backdrop-blur-xl"
        closeButtonClassName="text-white"
        closeIconClassName="size-[22px]"
      >
        <div className="flex h-full flex-col">
          <div className="mt-10 flex-1 overflow-y-auto px-3 pb-6">
            {items.map(([widgetIntent, label, icon, comingSoon, options]) => {
              const itemContent = (
                <>
                  {icon({ color: 'inherit' })}
                  <div className="flex flex-1 items-center gap-2">
                    <Text variant="large" className="text-left leading-4 text-inherit">
                      <Trans>{label}</Trans>
                    </Text>
                    {showNewDot(widgetIntent) && !comingSoon && (
                      <span className="bg-textEmphasis h-2 w-2 shrink-0 rounded-full" />
                    )}
                  </div>
                  {comingSoon && (
                    <Text variant="small" className={soonPillClasses}>
                      <Trans>Soon</Trans>
                    </Text>
                  )}
                </>
              );

              if (comingSoon || options?.disabled) {
                return (
                  <Button
                    key={widgetIntent}
                    disabled
                    variant="ghost"
                    className="text-textSecondary mb-2 h-auto w-full justify-start gap-3 px-3 py-3 disabled:cursor-not-allowed disabled:text-[rgba(198,194,255,0.4)]"
                  >
                    {itemContent}
                  </Button>
                );
              }
              return (
                <ModuleNavLink
                  key={widgetIntent}
                  targetIntent={widgetIntent}
                  search={searchForIntent(widgetIntent)}
                  onClick={event => {
                    handleNavClick(widgetIntent, 'mobile_drawer')(event);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'text-textSecondary mb-2 flex w-full items-center justify-start gap-3 rounded-md px-3 py-3 transition-colors',
                    'hover:bg-bgHover',
                    activeIntent === widgetIntent && 'bg-bgActive text-text hover:bg-bgActive'
                  )}
                >
                  {itemContent}
                </ModuleNavLink>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
