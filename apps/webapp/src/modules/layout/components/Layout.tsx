import React, { useContext } from 'react';
import { ConfigContext } from '../../config/context/ConfigContext';
import { ErrorBoundary } from './ErrorBoundary';
import { InsideLayoutContext } from './InsideLayoutContext';
import { AuthWrapper } from './AuthWrapper';
import { VStack } from './VStack';
import { Text } from '@/modules/layout/components/Typography';
import { IS_DEVELOPMENT_ENV, IS_STAGING_ENV } from '@/lib/constants';
import { Banner } from '@/components/extensible';
import { useWalletAnalytics } from '@/modules/analytics/hooks/useWalletAnalytics';
import { TopNav } from '@/modules/app/shell/TopNav';
import { MobileNavbar } from '@/modules/app/shell/MobileNavbar';
import { AppLoaderOverlay, appLoaderRevealClasses, useAppLoader } from '@/modules/app/components/AppLoader';
import { AppLink } from '@/lib/navigation';
import { cn } from '@/lib/cn';
import { shellHeaderClasses, shellHeaderContentClasses, shellSurfaceClasses } from './shellLayoutClasses';
import { PageFooter } from './PageFooter';
import { defaultConfig } from '../../config/default-config';

export function Layout({
  children,
  metaDescription
}: {
  children: React.ReactNode;
  metaDescription?: string;
}): React.ReactElement {
  const { siteConfig } = useContext(ConfigContext);
  // First-visit loader (APP-419): while it covers, the chrome and content
  // wear opacity-0 and the logomark overlay plays; on reveal they run their
  // one-shot entrances. `off` leaves every className exactly as it was. On a
  // manual first connect the cover also sorts the landing (APP-295).
  const { phase: loaderPhase, coverMode, released, revealAnimated, endCover } = useAppLoader();

  useWalletAnalytics();

  const showEnvInfo = (IS_STAGING_ENV || IS_DEVELOPMENT_ENV) && import.meta.env.VITE_CF_PAGES_COMMIT_SHA;

  const titleContent = `${siteConfig.name} | ${metaDescription || siteConfig.description}`;
  const descriptionContent = metaDescription || siteConfig.description;

  return (
    <InsideLayoutContext.Provider value={true}>
      <div>
        <title>{titleContent}</title>
        <meta name="description" content={descriptionContent} />
        <link rel="icon" href={siteConfig.favicon} />

        {/* Viewport-fixed page background (image + bottom fade), pinned while the
          document scrolls. Defined in globals.css; theme-swapped via the
          --background-image-app-background token. */}
        <div aria-hidden className="app-background" />

        <VStack className={shellSurfaceClasses()}>
          <ErrorBoundary>
            <div
              className={cn(
                shellHeaderClasses(),
                appLoaderRevealClasses(loaderPhase, 'chrome', revealAnimated)
              )}
            >
              <div className={shellHeaderContentClasses()}>
                {/* justify-self-start: in the header grid (tablet seam up) the
                  logo sits in a 1fr flank; without it the anchor stretches
                  across the whole track and empty header space becomes
                  clickable. */}
                <AppLink to="/" title="Home page" className="min-w-[96px] lg:justify-self-start">
                  {/* Theme-specific logo: dark is the default; light swaps in under
                    [data-theme='light'] (the `light:` variant). */}
                  <img src={defaultConfig.logo} alt="logo" width={96} className="light:hidden" />
                  <img src={defaultConfig.logoLight} alt="logo" width={96} className="light:block hidden" />
                </AppLink>
                <TopNav />
              </div>
            </div>
          </ErrorBoundary>

          {/* `page-transition` names this box as the only view-transition group
            (globals.css), so a route change animates the page and nothing else:
            the background, header and bottom navbar are uncaptured and keep
            painting live, which is what holds them still.

            The footer is inside it. Uncaptured elements paint from the *new*
            DOM the instant the transition starts, so a footer left outside
            adopted the incoming page's layout a frame after the click — on a
            short page → tall page navigation that dropped it off the bottom of
            the screen while the outgoing page was still sliding out, and it
            read as the footer vanishing. It belongs to the page anyway.

            flex-1 so the column fills the surface and the footer's `mt-auto`
            has space to push against; the gap and centering are the ones this
            box inherited from the surface. */}
          <div
            className={cn(
              'page-transition flex w-full flex-1 flex-col items-center gap-y-4',
              appLoaderRevealClasses(loaderPhase, 'content', revealAnimated)
            )}
          >
            <ErrorBoundary>
              {/* A wallet on a chain the app doesn't configure used to raise a
                blocking dialog here. It no longer does: wagmi pins its chainId
                to the last configured chain, so every read still resolves and
                the page renders correctly — and the route's chain resolution
                (getRouteChainAction rule b) switches the wallet back on the
                user's behalf. If they decline, the transaction modal's chain
                guard is what stops a transaction, where it actually matters. */}
              <AuthWrapper>{children}</AuthWrapper>
            </ErrorBoundary>

            <ErrorBoundary variant="small">
              <PageFooter />
            </ErrorBoundary>
          </div>

          {/* Clearance for the fixed bottom MobileNavbar (60px pill + 16px top
            pad + max(16px, safe-area) bottom pad) so the end of the content can
            scroll out from under it. A spacer rather than padding utilities so
            it stays independent of the surface's own spacing. Phone tier only,
            like the bar itself. */}
          <div
            aria-hidden
            className="h-[calc(92px+env(safe-area-inset-bottom,0px))] w-full shrink-0 lg:hidden"
          />
        </VStack>

        <ErrorBoundary>
          {/* Opacity-only wrapper: it never gets a transform, so it can't
              become the containing block of the navbar's fixed pill. */}
          <div className={appLoaderRevealClasses(loaderPhase, 'chrome', revealAnimated)}>
            <MobileNavbar />
          </div>
        </ErrorBoundary>
        <AppLoaderOverlay phase={loaderPhase} mode={coverMode} released={released} onCoverEnd={endCover} />
        {/* The announcement banner joins the chrome reveal so it can't float
            over the cover's bare-background frame. */}
        <div className={appLoaderRevealClasses(loaderPhase, 'chrome', revealAnimated)}>
          <Banner />
        </div>
        {/* Joins the chrome reveal like the Banner above: without it the
            commit SHA floats over the cover's bare-background frame on
            dev/staging builds. */}
        {showEnvInfo && (
          <div
            className={cn(
              'absolute bottom-0 left-2',
              appLoaderRevealClasses(loaderPhase, 'chrome', revealAnimated)
            )}
          >
            <Text className="text-text text-xs">{import.meta.env.VITE_CF_PAGES_COMMIT_SHA}</Text>
          </div>
        )}
      </div>
    </InsideLayoutContext.Provider>
  );
}
