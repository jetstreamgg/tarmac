import React, { useContext } from 'react';
import { ConfigContext } from '../../config/context/ConfigContext';
import { ErrorBoundary } from './ErrorBoundary';
import { InsideLayoutContext } from './InsideLayoutContext';
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
import { PageFooter } from './PageFooter';
import { HeaderBlur } from './HeaderBlur';
import { defaultConfig } from '../../config/default-config';

export function Layout({
  children,
  metaDescription
}: {
  children: React.ReactNode;
  metaDescription?: string;
}): React.ReactElement {
  const { siteConfig } = useContext(ConfigContext);
  const { chain } = useConnection();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

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
            <div className={shellHeaderClasses()}>
              <HeaderBlur />
              <div className={shellHeaderContentClasses()}>
                {/* justify-self-start: in the desktop header grid the logo sits
                  in a 1fr flank; without it the anchor stretches across the
                  whole track and empty header space becomes clickable. */}
                <AppLink to="/" title="Home page" className="desktop:justify-self-start min-w-[96px]">
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

          <ErrorBoundary variant="small">
            <PageFooter />
          </ErrorBoundary>

          {/* Clearance for the fixed bottom MobileNavbar (60px pill + 16px top
            pad + max(16px, safe-area) bottom pad) so the end of the content can
            scroll out from under it. A spacer rather than padding utilities so
            it stays independent of the surface's own spacing. */}
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
    </InsideLayoutContext.Provider>
  );
}
