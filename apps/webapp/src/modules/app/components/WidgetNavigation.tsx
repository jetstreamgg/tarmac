import React, { useRef, useEffect, useState, useCallback, JSX } from 'react';
import { Intent } from '../../../lib/enums';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { WidgetContent } from '../types/Widgets';
import { AnimatePresence, motion } from 'framer-motion';
import { cardAnimations } from '@/modules/ui/animation/presets';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { QueryParams, mapIntentToQueryParam } from '@/lib/constants';
import { LinkedActionWrapper } from '@/modules/ui/components/LinkedActionWrapper';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface WidgetNavigationProps {
  widgetContent: WidgetContent;
  intent?: Intent;
  children?: React.ReactNode;
  hideTabs?: boolean;
}

export function WidgetNavigation({
  widgetContent,
  intent,
  children,
  hideTabs
}: WidgetNavigationProps): JSX.Element {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    selectedRewardContract,
    linkedActionConfig: { showLinkedAction }
  } = useConfigContext();
  const isRewardsOverview = !selectedRewardContract && intent === Intent.REWARDS_INTENT;

  const [, setSearchParams] = useSearchParams();

  const handleWidgetChange = (value: string) => {
    const queryParam = mapIntentToQueryParam(value as Intent);

    setSearchParams(prevParams => {
      // delete the query params when we navigate to a different widget by tab click
      const searchParams = deleteSearchParams(prevParams);

      // set the new widget parameter
      searchParams.set(QueryParams.Widget, queryParam);

      // I think this part needs to move too
      if (value === Intent.REWARDS_INTENT) {
        if (selectedRewardContract?.contractAddress)
          searchParams.set(QueryParams.Reward, selectedRewardContract.contractAddress);
      } else {
        searchParams.delete(QueryParams.Reward);
      }
      return searchParams;
    });
  };

  const contentMarginTop = isMobile ? 0 : 8;
  const contentPaddingTop = isMobile ? 0 : 2;
  const laExtraHeight = isMobile ? 61 : 100; // LA Wrapper and action button height
  const baseTabContentClasses = 'md:h-full md:flex-1';
  const tabContentClasses = isRewardsOverview
    ? `${baseTabContentClasses} pl-6 pt-2 pr-0 pb-0 md:p-3 md:pb-3 md:pr-0 md:pt-2 xl:p-4 xl:pb-4 xl:pr-0`
    : intent === Intent.BALANCES_INTENT
      ? `${baseTabContentClasses} pl-6 pt-2 pr-0 pb-0 md:p-3 md:pb-0 md:pr-0 md:pt-2 xl:p-4 xl:pb-0 xl:pr-0`
      : `${baseTabContentClasses} pl-6 pt-2 pr-0 md:p-3 md:pr-0 md:pt-2 xl:p-4 xl:pr-0`;
  // If it's mobile, use the widget navigation row height + the height of the webiste header
  // as we're using 100vh for the content style, if not, just use the height of the navigation row
  // If the tab list is hidden, don't count it's height
  const headerHeight =
    (isMobile ? (hideTabs ? 56 : 63 + 56) : 66) + (contentMarginTop + contentPaddingTop) * 4;
  const topOffset = headerHeight;
  const style = isMobile
    ? { height: `calc(100dvh - ${topOffset + (showLinkedAction ? laExtraHeight : 0)}px)` }
    : undefined;
  const tabGlowClasses =
    'before:top-[-13px] xl:before:top-[-17px] before:absolute before:left-1/2 before:-translate-x-1/2 before:w-[120%] before:h-px before:bg-nav-light';

  // Memoized scroll function
  const scrollToTop = useCallback(() => {
    if (isMobile) {
      widgetRef.current?.scrollIntoView(true);
    }
  }, [isMobile]);

  // Effect to scroll to top when intent changes
  useEffect(() => {
    scrollToTop();
  }, [intent, scrollToTop]);

  return (
    <div className={`${isMobile ? 'w-full' : 'md:flex md:h-full'}`}>
      {/* Mobile hamburger menu - placed at the top on mobile */}
      {isMobile && !hideTabs && (
        <div className="flex items-center p-4 pb-2 md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="bg-bgPrimary border-borderPrimary rounded-xl"
                aria-label="Toggle menu"
              >
                <Menu size={24} className="text-text" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-borderPrimary w-[280px] bg-black/90 p-0">
              <div className="flex h-full flex-col">
                <div className="p-6 pb-4">
                  <Heading>
                    <Trans>Menu</Trans>
                  </Heading>
                </div>
                <div className="mt-10 flex-1 overflow-y-auto px-3 pb-6">
                  {widgetContent.map(group =>
                    group.items.map(([widgetIntent, label, icon, , comingSoon, options]) => (
                      <Button
                        key={widgetIntent}
                        onClick={() => {
                          handleWidgetChange(widgetIntent);
                          setIsMobileMenuOpen(false);
                        }}
                        disabled={options?.disabled || false}
                        variant="ghost"
                        className={cn(
                          'text-textSecondary mb-2 h-auto w-full justify-start gap-3 px-3 py-3 transition-colors',
                          'hover:bg-bgHover disabled:cursor-not-allowed disabled:text-[rgba(198,194,255,0.4)]',
                          intent === widgetIntent && 'bg-bgActive text-text hover:bg-bgActive'
                        )}
                      >
                        {icon({ color: 'inherit' })}
                        <Text variant="large" className="flex-1 text-left leading-4 text-inherit">
                          <Trans>{label}</Trans>
                        </Text>
                        {comingSoon && (
                          <Text
                            variant="small"
                            className="bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-textSecondary rounded-full px-1.5 py-0.5 text-[10px]"
                          >
                            <Trans>Soon</Trans>
                          </Text>
                        )}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Main content with tabs */}
      <Tabs
        ref={containerRef}
        className="w-full md:flex md:min-w-[424px] md:max-w-[512px] md:flex-row lg:min-w-[500px] lg:max-w-[500px]"
        defaultValue={Intent.BALANCES_INTENT}
        onValueChange={handleWidgetChange}
        value={intent}
        asChild
        activationMode="manual"
      >
        <motion.div layout transition={{ layout: { duration: 0 } }} className="md:flex md:w-full md:flex-row">
          {/* Desktop vertical tabs, hidden on mobile */}
          <div className="border-r-1 h-full justify-center">
            <TabsList
              className={cn(
                'sticky top-0 z-20 flex w-full justify-around rounded-none rounded-t-3xl border-b backdrop-blur-2xl',
                'md:scrollbar-thin md:static md:mt-3 md:h-fit md:max-h-[calc(100vh-120px)] md:w-auto md:flex-col md:justify-start md:gap-2 md:self-start md:overflow-y-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-filter-none',
                hideTabs && 'hidden',
                isMobile && 'hidden' // Hide the horizontal tabs on mobile when using Sheet
              )}
              data-testid="widget-navigation"
            >
              {widgetContent.map((group, groupIndex) => (
                <React.Fragment key={group.id}>
                  {group.items.map(([widgetIntent, label, icon, , comingSoon, options]) => (
                    <div
                      key={widgetIntent}
                      className="flex grow basis-[15%] justify-center md:w-full md:basis-auto md:justify-start"
                    >
                      <TabsTrigger
                        variant="icons"
                        value={widgetIntent}
                        className={cn(
                          'text-textSecondary data-[state=active]:text-text w-full px-1',
                          // Desktop vertical tabs - minimal styling
                          'md:justify-start md:gap-3 md:bg-transparent md:px-4 md:py-2 md:hover:bg-transparent',
                          'md:data-[state=active]:text-text md:data-[state=active]:bg-transparent',
                          'md:before:hidden', // Hide the glow effect on desktop vertical tabs
                          'disabled:cursor-not-allowed disabled:text-[rgba(198,194,255,0.4)]',
                          // Keep the existing mobile styling
                          'max-md:before:opacity-0',
                          'max-md:disabled:before:opacity-0 max-md:disabled:hover:before:opacity-0',
                          isMobile && tabGlowClasses,
                          isMobile && intent === widgetIntent && 'before:opacity-100 hover:before:opacity-100'
                        )}
                        disabled={options?.disabled || false}
                      >
                        {icon({ color: 'inherit' })}
                        <Text variant="small" className="leading-4 text-inherit">
                          <Trans>{label}</Trans>
                        </Text>
                        {comingSoon && (
                          <Text
                            variant="small"
                            className="bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-textSecondary absolute left-1/2 top-0 rounded-full px-1.5 py-0 md:static md:ml-auto md:px-1.5 md:py-0.5 md:text-[10px]"
                          >
                            <Trans>Soon</Trans>
                          </Text>
                        )}
                      </TabsTrigger>
                    </div>
                  ))}
                  {/* Add separator between groups (not after last group) */}
                  {groupIndex < widgetContent.length - 1 && !isMobile && (
                    <div className="md:border-b-1 hidden md:my-2 md:block md:h-px md:w-full" />
                  )}
                </React.Fragment>
              ))}
            </TabsList>
          </div>
          <div className="md:flex md:min-w-[352px] md:max-w-[440px] md:flex-1 md:flex-col md:overflow-hidden lg:min-w-[416px] lg:max-w-[416px]">
            <LinkedActionWrapper />
            <AnimatePresence initial={false} mode="popLayout">
              {widgetContent.map(group =>
                group.items.map(
                  ([int, , , content]) =>
                    intent === int && (
                      <TabsContent
                        key={int}
                        value={int}
                        className={cn(tabContentClasses, 'flex flex-col')}
                        style={style}
                        asChild
                      >
                        <motion.div
                          variants={cardAnimations}
                          initial={AnimationLabels.initial}
                          animate={AnimationLabels.animate}
                          exit={AnimationLabels.exit}
                          ref={widgetRef}
                          className={cn(
                            'md:scrollbar-thin flex-1 overflow-y-auto pr-4 md:pr-0',
                            isMobile
                              ? showLinkedAction
                                ? 'scroll-mt-[148px]'
                                : 'scroll-mt-[87px]'
                              : 'scroll-mt-[0px]'
                          )}
                        >
                          {content}
                        </motion.div>
                      </TabsContent>
                    )
                )
              )}
              {children}
            </AnimatePresence>
          </div>
        </motion.div>
      </Tabs>
    </div>
  );
}
