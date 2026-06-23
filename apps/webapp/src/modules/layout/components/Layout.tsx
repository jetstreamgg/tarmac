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
import { AppLink } from '@/lib/navigation';
import { shellHeaderClasses, shellSurfaceClasses } from './shellLayoutClasses';
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

      <VStack className={shellSurfaceClasses(fullWidth)}>
        <ErrorBoundary>
          <div className={shellHeaderClasses(fullWidth)}>
            <AppLink to="/" title="Home page" className="min-w-[96px]">
              {/* Theme-specific logo: dark is the default; light swaps in under
                  [data-theme='light'] (the `light:` variant). */}
              <img src={defaultConfig.logo} alt="logo" width={96} className="light:hidden" />
              <img src={defaultConfig.logoLight} alt="logo" width={96} className="light:block hidden" />
            </AppLink>
            <TopNav />
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          {isConnectedAndAcceptedTerms && !chain ? (
            <UnsupportedNetworkPage>{children}</UnsupportedNetworkPage>
          ) : (
            <AuthWrapper>{children}</AuthWrapper>
          )}
        </ErrorBoundary>
      </VStack>
      <Banner />
      {showEnvInfo && (
        <div className="absolute bottom-0 left-2">
          <Text className="text-text text-xs">{import.meta.env.VITE_CF_PAGES_COMMIT_SHA}</Text>
        </div>
      )}
    </div>
  );
}
