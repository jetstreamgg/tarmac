import React, { useContext } from 'react';
import { ConfigContext } from '../../config/context/ConfigContext';
import { ErrorBoundary } from './ErrorBoundary';
import { useConnection } from 'wagmi';
import { AuthWrapper } from './AuthWrapper';
import { VStack } from './VStack';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnsupportedNetworkPage } from './UnsupportedNetworkPage';
import { Text } from '@/modules/layout/components/Typography';
import { IS_DEVELOPMENT_ENV, IS_STAGING_ENV } from '@/lib/constants';
import { Banner } from '@/components/extensible';
import { useWalletAnalytics } from '@/modules/analytics/hooks/useWalletAnalytics';
import { TopNav } from '@/modules/app/shell/TopNav';
import { MobileNavbar } from '@/modules/app/shell/MobileNavbar';
import { AppLink } from '@/lib/navigation';
import { shellHeaderClasses, shellHeaderContentClasses, shellSurfaceClasses } from './shellLayoutClasses';
import { defaultConfig } from '../../config/default-config';

export function Layout({
  children,
  metaDescription,
  fullWidth = false
}: {
  children: React.ReactNode;
  metaDescription?: string;
  /**
   * Full-width destination routes scroll on the document instead of inside the
   * viewport-capped box: the VStack drops its height cap + `overflow-auto` so it
   * grows with content, and the header pins as a sticky frosted bar (B6). Legacy
   * two-pane routes keep the boxed scroll (the default).
   */
  fullWidth?: boolean;
}): React.ReactElement {
  const { siteConfig } = useContext(ConfigContext);
  const { chain } = useConnection();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  useWalletAnalytics();

  const showEnvInfo = (IS_STAGING_ENV || IS_DEVELOPMENT_ENV) && import.meta.env.VITE_CF_PAGES_COMMIT_SHA;

  const titleContent = `${siteConfig.name} | ${metaDescription || siteConfig.description}`;
  const descriptionContent = metaDescription || siteConfig.description;

  return (
    <div>
      <title>{titleContent}</title>
      <meta name="description" content={descriptionContent} />
      <link rel="icon" href={siteConfig.favicon} />

      {/* Viewport-fixed page background (image + bottom fade), pinned while the
          document scrolls. Defined in globals.css; theme-swapped via the
          --background-image-app-background token. */}
      <div aria-hidden className="app-background" />

      <VStack className={shellSurfaceClasses(fullWidth)}>
        <ErrorBoundary>
          <div className={shellHeaderClasses(fullWidth)}>
            <div className={shellHeaderContentClasses(fullWidth)}>
              <AppLink to="/" title="Home page" className="min-w-[96px]">
                {/* Theme-specific logo: dark is the default; light swaps in under
                    [data-theme='light'] (the `light:` variant). */}
                <img src={defaultConfig.logo} alt="logo" width={96} className="light:hidden" />
                <img src={defaultConfig.logoLight} alt="logo" width={96} className="light:block hidden" />
              </AppLink>
              <TopNav />
            </div>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          {isConnectedAndAcceptedTerms && !chain ? (
            <UnsupportedNetworkPage>{children}</UnsupportedNetworkPage>
          ) : (
            <AuthWrapper>{children}</AuthWrapper>
          )}
        </ErrorBoundary>

        {/* Clearance for the fixed bottom MobileNavbar (60px pill + 16px top
            pad + max(16px, safe-area) bottom pad) so the end of the content can
            scroll out from under it. A spacer instead of padding utilities so
            it can't collide with the boxed mode's md:pb-2. */}
        <div
          aria-hidden
          className="desktop:hidden h-[calc(92px+env(safe-area-inset-bottom,0px))] w-full shrink-0"
        />
      </VStack>

      <ErrorBoundary>
        <MobileNavbar />
      </ErrorBoundary>
      <Banner />
      {showEnvInfo && (
        <div className="absolute bottom-0 left-2">
          <Text className="text-text text-xs">{import.meta.env.VITE_CF_PAGES_COMMIT_SHA}</Text>
        </div>
      )}
    </div>
  );
}
