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
import { LinkedActionWrapper } from '@/modules/ui/components/LinkedActionWrapper';
import { cn } from '@/lib/utils';
import { Menu, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DualSwitcher } from '@/components/DualSwitcher';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useChains } from 'wagmi';
import { useEnhancedNetworkToast } from '@/modules/app/hooks/useEnhancedNetworkToast';
import { useNetworkAutoSwitch } from '@/modules/app/hooks/useNetworkAutoSwitch';
import { WidgetMenuItemTooltip } from '@/modules/app/components/WidgetMenuItemTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useScrollHint } from '@/modules/app/hooks/useScrollHint';

interface WidgetNavigationProps {
  widgetContent: WidgetContent;
  intent?: Intent;
  children?: React.ReactNode;
  hideTabs?: boolean;
  currentChainId?: number;
}

export function WidgetNavigation({
  widgetContent,
  intent,
  children,
  hideTabs,
  currentChainId
}: WidgetNavigationProps): JSX.Element {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const showDrawerMenu = bpi < BP.lg; // Show drawer menu on mobile and tablet
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    linkedActionConfig: { showLinkedAction }
  } = useConfigContext();

  // Scroll hint for vertical menu
  const { shouldShowHint, isOverflowing } = useScrollHint(tabsListRef, {
    enabled: !showDrawerMenu && !hideTabs
  });

  // Scroll active tab into view when intent changes
  useEffect(() => {
    if (showDrawerMenu || !activeTabRef.current || !tabsListRef.current) return;

    const timeoutId = window.setTimeout(() => {
      activeTabRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [intent, showDrawerMenu]);

  const { setIsSwitchingNetwork } = useNetworkSwitch();
  const chains = useChains();
  const { showNetworkToast } = useEnhancedNetworkToast();
  const [previousChainId, setPreviousChainId] = useState<number | undefined>(currentChainId);

  // Use the new network auto-switch hook
  const { handleWidgetNavigation, isAutoSwitching, previousIntent } = useNetworkAutoSwitch({
    currentChainId,
    currentIntent: intent
  });

  const handleWidgetChange = (value: string) => {
    const targetIntent = value as Intent;
    handleWidgetNavigation(targetIntent);
  };

  // Track network changes and show enhanced toast
  useEffect(() => {
    if (currentChainId && previousChainId && currentChainId !== previousChainId) {
      const prevChain = chains.find(c => c.id === previousChainId);
      const currChain = chains.find(c => c.id === currentChainId);

      if (prevChain && currChain) {
        // Reset switching state when network change completes
        setIsSwitchingNetwork(false);

        // Show enhanced network toast with quick switch options
        showNetworkToast({
          previousChain: { id: prevChain.id, name: prevChain.name },
          currentChain: { id: currChain.id, name: currChain.name },
          currentIntent: intent,
          previousIntent: previousIntent,
          isAutoSwitch: isAutoSwitching
        });
      }
    }
    setPreviousChainId(currentChainId);
  }, [
    currentChainId,
    chains,
    intent,
    previousIntent,
    showNetworkToast,
    setIsSwitchingNetwork,
    isAutoSwitching
  ]);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const updateSize = () => {
      setHeight(containerElement.offsetHeight);
    };
    updateSize();

    // Create observer to watch for changes in card size
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerElement);

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  const contentMarginTop = isMobile ? 0 : 8;
  const contentPaddingTop = isMobile ? 0 : 2;
  const laExtraHeight = isMobile ? 61 : showDrawerMenu ? 44 : 100; // LA Wrapper and action button height
  const tabContentClasses = 'pl-4 pt-2 pr-1.5 pb-4 md:pl-1.5 md:pr-0 md:pb-1 lg:py-1 lg:pr-0';
  // If it's mobile, use the widget navigation row height + the height of the webiste header
  // as we're using 100vh for the content style, if not, just use the height of the navigation row
  // If the tab list is hidden, don't count it's height
  const headerHeight =
    (isMobile ? (hideTabs ? 56 : 63 + 56) : 66) + (contentMarginTop + contentPaddingTop) * 4;
  const style = isMobile
    ? { height: `calc(100dvh - ${headerHeight + (showLinkedAction ? laExtraHeight : 0)}px)` }
    : showDrawerMenu
      ? { height: `${height - 52 - (showLinkedAction ? laExtraHeight : 0)}px` }
      : undefined;
  const verticalTabGlowClasses =
    'before:-left-[17px] before:absolute before:top-1/2 before:-translate-y-1/2 before:h-[120%] before:w-px before:bg-nav-light-vertical';

  // Memoized scroll function
  const scrollToTop = useCallback(() => {
    if (isMobile) {
      menuRef.current?.scrollIntoView();
    }
  }, [isMobile]);

  // Effect to scroll to top when intent changes
  useEffect(() => {
    scrollToTop();
  }, [intent, scrollToTop]);

  return (
    <div ref={containerRef} className={`${showDrawerMenu ? 'w-full' : 'lg:flex lg:h-full'}`}>
      {/* Mobile and tablet hamburger menu */}
      {showDrawerMenu && !hideTabs && (
        <div
          className="flex items-center justify-between p-4 pb-2 md:pt-1 md:pr-2.5 md:pl-1.5 lg:hidden"
          ref={menuRef}
        >
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
            <SheetContent
              side="left"
              className="border-borderPrimary w-[280px] bg-black/10 p-0 backdrop-blur-xl"
              closeButtonClassName="text-white"
              closeIconClassName="size-[22px]"
            >
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
                            className="from-primary-start/100 to-primary-end/100 text-textSecondary rounded-full bg-radial-(--gradient-position) px-1.5 py-0.5 text-[10px]"
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
            {/* Only show the dual switcher in this row for mobile and tablet in portrait mode */}
            <DualSwitcher className="flex lg:hidden" />
          </Sheet>
        </div>
      )}

      {/* Main content with tabs */}
      <Tabs
        className="w-full lg:flex lg:flex-row"
        defaultValue={Intent.BALANCES_INTENT}
        onValueChange={handleWidgetChange}
        value={intent}
        asChild
        activationMode="manual"
      >
        <motion.div layout transition={{ layout: { duration: 0 } }} className="lg:flex lg:w-full lg:flex-row">
          {/* Desktop vertical tabs, hidden on mobile and tablet */}
          <div className="relative">
            <TooltipProvider>
              {/* Outer container with overflow-visible for tooltips */}
              <div className={cn('overflow-visible', hideTabs && 'hidden', showDrawerMenu && 'hidden')}>
                {/* Inner scrollable container */}
                <TabsList
                  ref={tabsListRef}
                  className={cn(
                    `scrollbar-hidden flex h-fit max-h-[calc(100vh-120px)] flex-col justify-start gap-2 py-1 pr-[10px] pl-1 ${isOverflowing ? 'overflow-y-scroll' : 'overflow-y-clip'}`
                  )}
                  data-testid="widget-navigation"
                >
                  {widgetContent.map((group, groupIndex) => (
                    <React.Fragment key={group.id}>
                      {group.items.map(([widgetIntent, label, icon, , comingSoon, options, description]) => (
                        <div
                          key={widgetIntent}
                          className="flex grow basis-[15%] justify-center md:w-full md:basis-auto md:justify-start"
                        >
                          <WidgetMenuItemTooltip
                            description={description}
                            widgetIntent={widgetIntent}
                            currentChainId={currentChainId}
                            label={label as string}
                            isMobile={isMobile}
                            disabled={options?.disabled || false}
                            isCurrentWidget={intent === widgetIntent}
                          >
                            <TabsTrigger
                              ref={intent === widgetIntent ? activeTabRef : null}
                              variant="icons"
                              value={widgetIntent}
                              className={cn(
                                'text-textSecondary data-[state=active]:text-text relative h-[78px] w-full px-1',
                                'lg:justify-start lg:gap-1.5 lg:bg-transparent lg:py-2 lg:hover:bg-transparent',
                                'lg:data-[state=active]:text-text lg:data-[state=active]:bg-transparent',
                                'disabled:cursor-not-allowed disabled:text-[rgba(198,194,255,0.4)]',
                                !showDrawerMenu && intent === widgetIntent && verticalTabGlowClasses,
                                showDrawerMenu &&
                                  intent === widgetIntent &&
                                  'before:opacity-100 hover:before:opacity-100'
                              )}
                              disabled={options?.disabled || false}
                            >
                              <div className="flex h-full flex-col items-center justify-center gap-1">
                                {!isMobile && icon({ color: 'inherit' })}
                                <Text variant="small" className="leading-4 text-inherit">
                                  <Trans>{label}</Trans>
                                </Text>
                              </div>
                              {comingSoon && (
                                <Text
                                  variant="small"
                                  className="from-primary-start/100 to-primary-end/100 text-textSecondary absolute top-0 left-1/2 -mt-2 rounded-full bg-radial-(--gradient-position) px-1.5 py-0 lg:static lg:px-1.5 lg:py-0.5 lg:text-[10px]"
                                >
                                  <Trans>Soon</Trans>
                                </Text>
                              )}
                            </TabsTrigger>
                          </WidgetMenuItemTooltip>
                        </div>
                      ))}
                      {groupIndex < widgetContent.length - 1 && !showDrawerMenu && (
                        <div className="hidden lg:my-2 lg:block lg:h-px lg:w-full lg:border-b-1" />
                      )}
                    </React.Fragment>
                  ))}
                </TabsList>
              </div>
            </TooltipProvider>
            {/* Scroll hint indicator */}
            <AnimatePresence>
              {shouldShowHint && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="bg-textSecondary/20 absolute bottom-4 left-1/2 translate-x-[-21px] rounded-full p-2"
                >
                  <ChevronDown
                    className="scroll-hint-indicator text-textSecondary"
                    size={20}
                    strokeWidth={2.5}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:max-w-[440px] md:min-w-[352px] lg:flex lg:max-w-[416px] lg:min-w-[416px] lg:flex-1 lg:flex-col lg:overflow-hidden">
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
                          className={cn(
                            'flex-1 overflow-y-auto md:pr-0 lg:overflow-hidden',
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
